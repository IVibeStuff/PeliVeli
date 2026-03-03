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

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const OC_HEADERS = {
  'User-Agent': BROWSER_UA, 'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9', 'Origin': 'https://opencritic.com', 'Referer': 'https://opencritic.com/',
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
      if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`))
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (_) { reject(new Error('invalid json')) }
      })
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

const OC_TIER_MAP = { 'Mighty': 'Mighty', 'Strong': 'Strong', 'Fair': 'Fair', 'Weak': 'Weak' }

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
    const search = await fetchJsonRaw(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(game.title)}`, headers)
    if (!search.success || !search.data || search.data.length === 0) { log(`SGDB: no search results for "${game.title}"`); return null }
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

// ─── OpenCritic ─────────────────────────────────────────────────────────────

function cleanTitle(title) {
  return title
    .replace(/[™®©]/g, '')
    .replace(/\s*[-–:]\s*(Complete Edition|Game of the Year|GOTY|Definitive Edition|Enhanced Edition|Remastered|Gold Edition|Deluxe Edition|Standard Edition|Ultimate Edition|Anniversary Edition).*$/i, '')
    .replace(/\s+/g, ' ').trim()
}

function titleSimilarity(a, b) {
  const na = cleanTitle(a).toLowerCase(), nb = cleanTitle(b).toLowerCase()
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = new Set(na.split(/\s+/)), wb = new Set(nb.split(/\s+/))
  const inter = [...wa].filter(w => wb.has(w)).length
  return inter / Math.max(wa.size, wb.size)
}

async function getOpenCriticScore(title) {
  const clean = cleanTitle(title)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(attempt * 1500)
      const results = await fetchJsonRaw(
        `https://api.opencritic.com/api/game/search?criteria=${encodeURIComponent(clean)}`,
        OC_HEADERS
      )
      if (!Array.isArray(results) || results.length === 0) { log(`OC: no results for "${clean}"`); return null }
      let best = null, bestSim = 0
      for (const r of results.slice(0, 10)) {
        const sim = titleSimilarity(clean, r.name || '')
        if (sim > bestSim) { bestSim = sim; best = r }
      }
      log(`OC best match for "${clean}": "${best?.name}" sim=${bestSim.toFixed(2)}`)
      if (!best || bestSim < 0.25) return null
      await sleep(400)
      const detail = await fetchJsonRaw(`https://api.opencritic.com/api/game/${best.id}`, OC_HEADERS)
      if (!detail) continue
      const tier      = detail.tier ? (OC_TIER_MAP[detail.tier] || null) : null
      const score     = typeof detail.topCriticScore === 'number' && detail.topCriticScore >= 0 ? Math.round(detail.topCriticScore) : null
      const recommend = typeof detail.percentRecommended === 'number' ? Math.round(detail.percentRecommended) : null
      if (!tier && score === null) return null
      log(`OC result for "${title}": tier=${tier} score=${score}`)
      return { score, tier, recommend, url: `https://opencritic.com/game/${detail.id}` }
    } catch (err) {
      log(`OC error [${attempt + 1}] "${title}": ${err.message}`)
      if (err.message === 'rate_limited') await sleep(5000)
    }
  }
  return null
}

async function fetchOcById(gameId) {
  try {
    const detail = await fetchJsonRaw(`https://api.opencritic.com/api/game/${gameId}`, OC_HEADERS)
    if (!detail) return null
    const tier      = detail.tier ? (OC_TIER_MAP[detail.tier] || null) : null
    const score     = typeof detail.topCriticScore === 'number' && detail.topCriticScore >= 0 ? Math.round(detail.topCriticScore) : null
    const recommend = typeof detail.percentRecommended === 'number' ? Math.round(detail.percentRecommended) : null
    const slug      = (detail.url || '').split('/').filter(Boolean).pop() || String(gameId)
    return { ocScore: score, ocTier: tier, ocRecommend: recommend, ocUrl: `https://opencritic.com/game/${detail.id}/${slug}`, name: detail.name }
  } catch (err) {
    log(`fetchOcById(${gameId}): ${err.message}`)
    return null
  }
}

// ─── Main enrichment loop ───────────────────────────────────────────────────

async function enrichAll(games, config, sendProgress) {
  try { fs.writeFileSync(LOG_FILE, `=== Enrichment run ${new Date().toISOString()} ===\n`) } catch (_) {}
  if (!config.sgdbApiKey) log('NOTE: No SteamGridDB API key — Epic/Ubisoft/EA cover art will be skipped')

  const enriched = []
  for (let i = 0; i < games.length; i++) {
    const game = { ...games[i] }
    sendProgress(`Enriching ${i + 1}/${games.length}: ${game.title}`)

    if (!fileIsValid(game.coverArt)) {
      game.coverArt = null
      try { game.coverArt = await getCoverArt(game, config) } catch (err) { log(`Cover exception "${game.title}": ${err.message}`) }
    }

    if (game.ocScore == null) {
      try {
        const titleForOc = game.displayTitle || game.title
        const oc = await getOpenCriticScore(titleForOc)
        if (oc) {
          game.ocScore = oc.score; game.ocTier = oc.tier; game.ocRecommend = oc.recommend
          if (!game.ocUrl) game.ocUrl = oc.url
        }
      } catch (err) { log(`OC exception "${game.title}": ${err.message}`) }
      await sleep(300)
    }

    enriched.push(game)
  }

  sendProgress('Enrichment complete.')
  return enriched
}

module.exports = { enrichAll, fetchOcById, fetchCoverArt: getCoverArt, fetchOcByTitle: getOpenCriticScore }
