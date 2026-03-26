const fs    = require('fs')
const path  = require('path')
const https = require('https')
const http  = require('http')
const { app } = require('electron')

const CACHE_DIR = path.join(app.getPath('userData'), 'covers')
const LOG_FILE  = path.join(app.getPath('userData'), 'enrich-debug.log')

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch (_) {}
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
const OC_HEADERS = {
  'User-Agent':      BROWSER_UA,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin':          'https://opencritic.com',
  'Referer':         'https://opencritic.com/',
  'sec-ch-ua':       '"Chromium";v="134", "Google Chrome";v="134", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile':   '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest':  'empty',
  'sec-fetch-mode':  'cors',
  'sec-fetch-site':  'same-site',
  'Connection':      'keep-alive',
}
function sgdbHeaders(apiKey) {
  return { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'User-Agent': BROWSER_UA }
}
const CDN_HEADERS = { 'User-Agent': BROWSER_UA }

function fetchJsonRaw(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJsonRaw(res.headers.location, headers).then(resolve).catch(reject)
      }
      if (res.statusCode === 429) return reject(new Error('rate_limited'))
      if (res.statusCode === 403) return reject(new Error('HTTP 403 forbidden'))
      if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`))

      // Handle gzip/deflate compression
      let stream = res
      const encoding = res.headers['content-encoding']
      if (encoding === 'gzip' || encoding === 'deflate' || encoding === 'br') {
        const zlib = require('zlib')
        const decomp = encoding === 'br' ? zlib.createBrotliDecompress()
                     : encoding === 'gzip' ? zlib.createGunzip()
                     : zlib.createInflate()
        res.pipe(decomp)
        stream = decomp
      }

      let data = ''
      stream.on('data', chunk => { data += chunk })
      stream.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (_) {
          // Log the first 200 chars so we can see what came back (challenge page, error HTML, etc)
          log(`fetchJsonRaw: invalid JSON from ${url.slice(0,80)} — response starts: ${data.slice(0,200)}`)
          reject(new Error('invalid json'))
        }
      })
      stream.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers: CDN_HEADERS }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`))
      const out = fs.createWriteStream(destPath)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function fileIsValid(p) {
  try { return p && fs.existsSync(p) && fs.statSync(p).size > 1000 } catch (_) { return false }
}
function cleanFile(p) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch (_) {} }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const OC_TIER_MAP = {} // kept for migration compatibility — no longer used

// ─── SteamGridDB cover art ──────────────────────────────────────────────────

async function sgdbCoverUrl(game, apiKey) {
  if (!apiKey) return null
  const headers = sgdbHeaders(apiKey)
  try {
    // Try by Steam appId first
    if (game.platform === 'Steam' && game.appId) {
      const data = await fetchJsonRaw(`https://www.steamgriddb.com/api/v2/grids/steam/${game.appId}?dimensions=600x900`, headers)
      if (data.success && data.data && data.data.length > 0) {
        log(`SGDB: steam appId hit for "${game.title}"`)
        return data.data[0].url
      }
    }
    // Search by name
    const search = await fetchJsonRaw(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(game.displayTitle || game.title)}`, headers)
    if (!search.success || !search.data || search.data.length === 0) { log(`SGDB: no search results for "${game.displayTitle || game.title}"`); return null }
    const gameId = search.data[0].id
    await sleep(200)
    const grids = await fetchJsonRaw(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900`, headers)
    if (grids.success && grids.data && grids.data.length > 0) {
      log(`SGDB: name search hit for "${game.title}"`)
      return grids.data[0].url
    }
    return null
  } catch (err) {
    log(`SGDB error for "${game.title}": ${err.message}`)
    return null
  }
}

function steamCoverUrls(appId) {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  ]
}

async function getCoverArt(game, config) {
  ensureCacheDir()
  const safeTitle = game.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)
  const filename  = `${game.platform.toLowerCase()}_${safeTitle}_${game.appId || 'x'}.jpg`
  const destPath  = path.join(CACHE_DIR, filename)

  if (fileIsValid(destPath)) return destPath

  let urls = []

  if (game.platform === 'Steam' && game.appId) {
    urls = steamCoverUrls(game.appId)
  } else if (game.platform === 'GOG' && game.appId) {
    try {
      const gogData = await fetchJsonRaw(`https://api.gog.com/v1/games/${game.appId}`, {})
      const imgId = gogData?._links?.boxArtImage?.href
      if (imgId) urls.push(imgId + '_product_card_v2_mobile_slider_639.jpg')
    } catch (_) {}
  }

  // Try SGDB as first fallback for non-Steam, or if Steam CDN fails
  if (urls.length === 0 || game.platform !== 'Steam') {
    const sgdbUrl = await sgdbCoverUrl(game, config.sgdbApiKey)
    if (sgdbUrl) urls.push(sgdbUrl)
  }

  // For Steam, also try SGDB if CDN fails
  if (game.platform === 'Steam') {
    const sgdbUrl = await sgdbCoverUrl(game, config.sgdbApiKey)
    if (sgdbUrl) urls.push(sgdbUrl)
  }

  for (const url of urls) {
    try {
      await downloadFile(url, destPath)
      if (fileIsValid(destPath)) {
        log(`Cover OK for "${game.title}" via ${url.slice(0, 60)}`)
        return destPath
      }
      cleanFile(destPath)
    } catch (err) {
      log(`Cover fail for "${game.title}" (${url.slice(0, 60)}): ${err.message}`)
      cleanFile(destPath)
    }
  }
  return null
}

// ─── Fetch cover art by explicit SGDB game ID ────────────────────────────────
// Used when the user pastes a steamgriddb.com/game/XXXXX URL manually

async function getCoverArtBySgdbId(game, sgdbGameId, config) {
  ensureCacheDir()
  if (!config.sgdbApiKey) return null
  const headers  = sgdbHeaders(config.sgdbApiKey)
  const safeTitle = (game.displayTitle || game.title).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)
  const filename  = `${game.platform.toLowerCase()}_${safeTitle}_${game.appId || 'x'}.jpg`
  const destPath  = path.join(CACHE_DIR, filename)
  cleanFile(destPath) // always re-fetch when manually specified
  try {
    const grids = await fetchJsonRaw(
      `https://www.steamgriddb.com/api/v2/grids/game/${sgdbGameId}?dimensions=600x900`,
      headers
    )
    if (!grids.success || !grids.data || grids.data.length === 0) {
      log(`SGDB manual: no grids for game ID ${sgdbGameId}`)
      return null
    }
    // Also grab the game name for display
    const gameInfo = await fetchJsonRaw(
      `https://www.steamgriddb.com/api/v2/games/${sgdbGameId}`,
      headers
    ).catch(() => null)
    const sgdbName = gameInfo?.data?.name || null
    await downloadFile(grids.data[0].url, destPath)
    if (fileIsValid(destPath)) {
      log(`SGDB manual: cover OK for "${game.title}" via game ID ${sgdbGameId}`)
      return { coverPath: destPath, sgdbName }
    }
    cleanFile(destPath)
    return null
  } catch (err) {
    log(`SGDB manual error for "${game.title}" ID ${sgdbGameId}: ${err.message}`)
    return null
  }
}

// ─── OpenCritic ─────────────────────────────────────────────────────────────
// OC search now requires an API key (post-Valnet acquisition). These stubs are
// kept so existing stored ocUrl/ocScore data is not lost on re-enrich, but no
// new OC lookups are made.

async function getOpenCriticScore() { return null }
async function fetchOcById()        { return null }

// ─── Main enrichment loop ───────────────────────────────────────────────────

// ─── Main enrichment loop ───────────────────────────────────────────────────

async function enrichAll(games, config, sendProgress) {
  try { fs.writeFileSync(LOG_FILE, `=== Enrichment run ${new Date().toISOString()} ===\n`) } catch (_) {}
  if (!config.sgdbApiKey) log('NOTE: No SteamGridDB API key — cover art for non-Steam games will be skipped')

  const enriched = []
  for (let i = 0; i < games.length; i++) {
    const game = { ...games[i] }
    sendProgress(`Enriching ${i + 1}/${games.length}: ${game.displayTitle || game.title}`)

    if (!fileIsValid(game.coverArt)) {
      game.coverArt = null
      try { game.coverArt = await getCoverArt(game, config) } catch (err) { log(`Cover exception "${game.title}": ${err.message}`) }
    }

    enriched.push(game)
  }

  sendProgress('Enrichment complete.')
  return enriched
}

module.exports = { enrichAll, fetchCoverArt: getCoverArt, fetchCoverArtBySgdbId: getCoverArtBySgdbId }
