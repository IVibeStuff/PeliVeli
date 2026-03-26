// Wishlist pricing via IsThereAnyDeal API (https://docs.isthereanydeal.com/)
// Requires a free API key from isthereanydeal.com/apps/my/

const https = require('https')

function itadGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?'
    const url = `https://api.isthereanydeal.com${path}${sep}key=${apiKey}`
    const req = https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'PeliVeli/1.0' } }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`))
          return
        }
        try { resolve(JSON.parse(data)) } catch (_) { reject(new Error('Invalid JSON from ITAD')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function itadPost(path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?'
    const fullPath = `${path}${sep}key=${apiKey}`
    const bodyStr = JSON.stringify(body)
    const opts = {
      hostname: 'api.isthereanydeal.com',
      path: fullPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Accept': 'application/json',
        'User-Agent': 'PeliVeli/1.0',
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`))
          return
        }
        try { resolve(JSON.parse(data)) } catch (_) { reject(new Error('Invalid JSON from ITAD')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(bodyStr)
    req.end()
  })
}

// Search for games by name — returns lightweight list for the search dropdown
async function findGames(query, apiKey) {
  if (!apiKey) return []
  try {
    const results = await itadGet(
      `/games/search/v1?title=${encodeURIComponent(query)}&results=10`,
      apiKey
    )
    return Array.isArray(results)
      ? results
          .filter(g => g.type === 'game')   // skip DLC
          .slice(0, 8)
          .map(g => ({ id: g.id, name: g.title, slug: g.slug }))
      : []
  } catch (err) {
    console.error('[wishlist] find error:', err.message)
    return []
  }
}

// Fetch prices for an ITAD game ID + country code, returns flat list of offers
async function fetchPrices(itadGameId, country, apiKey) {
  if (!apiKey) return { offers: [], error: 'No IsThereAnyDeal API key — add one in Settings → Account' }
  if (!itadGameId) return { offers: [], error: 'No game ID stored — remove and re-add this wishlist entry' }

  // ITAD uses UUIDs — if the stored ID is a legacy AllKeyShop numeric ID, tell the user to re-add
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itadGameId)
  if (!isUuid) return { offers: [], error: 'This entry was added before v1.2.0 — please remove and re-add it to fetch prices' }

  try {
    // country default: EE (Estonia, EUR)
    const cc = (country || 'EE').toUpperCase()
    const results = await itadPost(`/games/prices/v3?country=${cc}`, [itadGameId], apiKey)

    if (!Array.isArray(results) || results.length === 0) {
      return { offers: [], error: 'No prices found for this game' }
    }

    const gameData = results[0]
    if (!gameData?.deals?.length) {
      return { offers: [], error: 'No current offers found' }
    }

    const offers = gameData.deals.map(d => ({
      id:       d.url,
      store:    d.shop?.name || 'Unknown',
      price:    d.price?.amount ?? 0,
      currency: d.price?.currency || cc,
      regular:  d.regular?.amount ?? d.price?.amount ?? 0,
      cut:      d.cut ?? 0,
      url:      d.url || '',
      drm:      d.drm?.map(x => x.name).join(', ') || '',
    })).sort((a, b) => a.price - b.price)

    return { offers }
  } catch (err) {
    console.error('[wishlist] fetchPrices error:', err.message)
    return { offers: [], error: err.message }
  }
}

module.exports = { findGames, fetchPrices }

