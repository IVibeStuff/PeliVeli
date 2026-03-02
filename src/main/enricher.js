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

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// OpenCritic needs Origin/Referer to not be rejected
const OC_HEADERS = {
  'User-Agent':      BROWSER_UA,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':          'https://opencritic.com',
  'Referer':         'https://opencritic.com/',
}

// SteamGridDB uses a Bearer token
function sgdbHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Accept':        'application/json',
    'User-Agent':    BROWSER_UA,
  }
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
      if (res.statusCode === 404) return resolve(null)
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (!data.trim()) { reject(new Error(`empty_response (HTTP ${res.statusCode})`)); return }
        if (data.trimStart().startsWith('<')) { reject(new Error(`html_response (HTTP ${res.statusCode})`)); return }
        try { resolve(JSON.parse(data)) }
        catch (_) { reject(new Error(`parse_error: ${data.slice(0, 120)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(14000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers: CDN_HEADERS }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const file = fs.createWriteStream(destPath)
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', (err) => { try { fs.unlinkSync(destPath) } catch (_) {}; reject(err) })
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function fileIsValid(p) {
  try { return fs.existsSync(p) && fs.statSync(p).size > 2000 } catch (_) { return false }
}
function cleanFile(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch (_) {}
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── SteamGridDB cover art ────────────────────────────────────────────────────
//
// API docs: https://www.steamgriddb.com/api/v2
//
// Flow:
//   Steam games  → look up directly by Steam App ID (no name search needed, 100% accurate)
//   Other games  → search by name → get SGDB game ID → fetch grids
//
// Grid dimensions 600x900 = portrait cover art (same ratio as Steam library art)

async function sgdbCoverUrl(game, apiKey) {
  const base    = 'https://www.steamgriddb.com/api/v2'
  const headers = sgdbHeaders(apiKey)

  let sgdbGameId = null

  if (game.platform === 'Steam' && game.appId) {
    // Direct Steam App ID lookup — most reliable path
    try {
      const res = await fetchJsonRaw(
        `${base}/grids/steam/${game.appId}?dimensions=600x900&types=static&nsfw=false`,
        headers
      )
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        // Pick highest-scored grid
        const sorted = res.data.sort((a, b) => (b.score || 0) - (a.score || 0))
        log(`SGDB Steam AppID ${game.appId}: found ${res.data.length} grids, using top-scored`)
        return sorted[0].url
      }
    } catch (err) {
      log(`SGDB Steam direct lookup failed for ${game.appId}: ${err.message}`)
    }
  }

  // For non-Steam games (or Steam fallback): search by name to get SGDB game ID
  if (!sgdbGameId) {
    const cleanName = game.title.replace(/[®™©]/g, '').trim()
    try {
      const searchRes = await fetchJsonRaw(
        `${base}/search/autocomplete/${encodeURIComponent(cleanName)}`,
        headers
      )
      if (searchRes?.success && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        // Pick best title match
        const titleLower = cleanName.toLowerCase()
        let best = null, bestSim = -1
        for (const r of searchRes.data) {
          const rLower = (r.name || '').toLowerCase()
          const sim = rLower === titleLower ? 1
            : rLower.includes(titleLower) || titleLower.includes(rLower) ? 0.8
            : 0
          if (sim > bestSim) { bestSim = sim; best = r }
        }
        if (best) {
          sgdbGameId = best.id
          log(`SGDB name search "${cleanName}" → matched "${best.name}" (id=${best.id})`)
        }
      }
    } catch (err) {
      log(`SGDB name search failed for "${game.title}": ${err.message}`)
    }
  }

  if (!sgdbGameId) return null

  // Fetch grids for the resolved game ID
  await sleep(200)
  try {
    const gridRes = await fetchJsonRaw(
      `${base}/grids/game/${sgdbGameId}?dimensions=600x900&types=static&nsfw=false`,
      headers
    )
    if (gridRes?.success && Array.isArray(gridRes.data) && gridRes.data.length > 0) {
      const sorted = gridRes.data.sort((a, b) => (b.score || 0) - (a.score || 0))
      log(`SGDB game ${sgdbGameId}: found ${gridRes.data.length} grids`)
      return sorted[0].url
    }
  } catch (err) {
    log(`SGDB grid fetch failed for game ${sgdbGameId}: ${err.message}`)
  }

  return null
}

// ─── Steam CDN cover art ──────────────────────────────────────────────────────

function steamCoverUrls(appId) {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
  ]
}

// ─── Main cover art resolver ──────────────────────────────────────────────────

async function getCoverArt(game, config) {
  ensureCacheDir()
  const filename  = `${game.id}.jpg`
  const cacheFile = path.join(CACHE_DIR, filename)

  if (fileIsValid(cacheFile)) return `peliveli://covers/${filename}`
  cleanFile(cacheFile)

  const hasSgdb = !!(config.sgdbApiKey)

  try {
    // ── Steam: try CDN first (free, no key, usually best quality) ──
    if (game.platform === 'Steam' && game.appId) {
      for (const url of steamCoverUrls(game.appId)) {
        try {
          await downloadFile(url, cacheFile)
          if (fileIsValid(cacheFile)) {
            log(`Cover "${game.title}": Steam CDN hit`)
            return `peliveli://covers/${filename}`
          }
          cleanFile(cacheFile)
        } catch (_) { cleanFile(cacheFile) }
      }
      // Steam CDN miss — fall through to SGDB if available
    }

    // ── SteamGridDB: covers all platforms ──
    if (hasSgdb) {
      const sgdbUrl = await sgdbCoverUrl(game, config.sgdbApiKey)
      if (sgdbUrl) {
        try {
          await downloadFile(sgdbUrl, cacheFile)
          if (fileIsValid(cacheFile)) {
            log(`Cover "${game.title}": SGDB hit`)
            return `peliveli://covers/${filename}`
          }
          cleanFile(cacheFile)
        } catch (err) {
          log(`Cover "${game.title}": SGDB download failed: ${err.message}`)
          cleanFile(cacheFile)
        }
      }
    }

    // ── GOG public API fallback (no key needed) ──
    if (game.platform === 'GOG') {
      try {
        const data = await fetchJsonRaw(
          `https://www.gog.com/games/ajax/filtered?mediaType=game&search=${encodeURIComponent(game.title)}&limit=3`,
          CDN_HEADERS
        )
        const products = (data && data.products) || []
        if (products.length > 0) {
          await downloadFile(`https:${products[0].image}_product_card_v2_mobile_slider_639.jpg`, cacheFile)
          if (fileIsValid(cacheFile)) {
            log(`Cover "${game.title}": GOG API hit`)
            return `peliveli://covers/${filename}`
          }
          cleanFile(cacheFile)
        }
      } catch (_) {}
    }

  } catch (_) { cleanFile(cacheFile) }

  log(`Cover "${game.title}": no source found`)
  return null
}

// ─── OpenCritic ───────────────────────────────────────────────────────────────

function cleanTitle(title) {
  return title
    .replace(/[®™©]/g, '')
    .replace(/\s*(gold|definitive|goty|deluxe|ultimate|complete|enhanced|remastered|director.s cut)\s*edition/gi, '')
    .replace(/\s+/g, ' ').trim()
}

function titleSimilarity(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  b = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  const wa = new Set(a.split(/\s+/).filter(Boolean))
  const wb = new Set(b.split(/\s+/).filter(Boolean))
  return [...wa].filter(w => wb.has(w)).length / Math.max(wa.size, wb.size)
}

const OC_TIER_MAP = { Mighty: 'Mighty', Strong: 'Strong', Fair: 'Fair', Weak: 'Weak' }

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

// ─── Main enrichment loop ─────────────────────────────────────────────────────

async function enrichAll(games, config, sendProgress) {
  try { fs.writeFileSync(LOG_FILE, `=== Enrichment run ${new Date().toISOString()} ===\n`) } catch (_) {}

  if (!config.sgdbApiKey) {
    log('NOTE: No SteamGridDB API key configured — Epic/Ubisoft/EA cover art will be skipped')
  }

  const enriched = []
  for (let i = 0; i < games.length; i++) {
    const game = { ...games[i] }
    sendProgress(`Enriching ${i + 1}/${games.length}: ${game.title}`)

    // Cover art
    if (!game.coverArt) {
      game.coverArt = await getCoverArt(game, config)
    }

    // OpenCritic score
    if (game.ocScore === undefined || game.ocScore === null) {
      await sleep(300)
      const oc = await getOpenCriticScore(game.title)
      if (oc) {
        game.ocScore     = oc.score
        game.ocTier      = oc.tier
        game.ocRecommend = oc.recommend
        game.ocUrl       = oc.url
      }
    }

    enriched.push(game)
    await sleep(150)
  }

  const covers = enriched.filter(g => g.coverArt).length
  const scores  = enriched.filter(g => g.ocScore !== null).length
  log(`=== Done: ${covers}/${enriched.length} covers, ${scores} OC scores ===`)
  sendProgress('Enrichment complete!')
  return enriched
}

// Fetch OC data by direct game ID — used when user pastes an OC URL manually
async function fetchOcById(gameId) {
  try {
    const detail = await fetchJsonRaw(
      `https://api.opencritic.com/api/game/${gameId}`,
      OC_HEADERS
    )
    if (!detail || detail.id === undefined) return null

    const tier      = detail.tier ? (OC_TIER_MAP[detail.tier] || null) : null
    const score     = typeof detail.topCriticScore === 'number' && detail.topCriticScore >= 0
                        ? Math.round(detail.topCriticScore) : null
    const recommend = typeof detail.percentRecommended === 'number'
                        ? Math.round(detail.percentRecommended) : null

    return {
      ocScore:     score,
      ocTier:      tier,
      ocRecommend: recommend,
      ocUrl:       `https://opencritic.com/game/${detail.id}/${detail.name?.toLowerCase().replace(/[^a-z0-9]+/g,'-') || ''}`,
      name:        detail.name,
    }
  } catch (err) {
    log(`fetchOcById(${gameId}) error: ${err.message}`)
    return null
  }
}

module.exports = { enrichAll, fetchOcById, fetchCoverArt: getCoverArt, fetchOcByTitle: getOpenCriticScore }
