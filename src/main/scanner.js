const fs   = require('fs')
const path = require('path')
const os   = require('os')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRead(p)    { try { return fs.readFileSync(p, 'utf8') } catch (_) { return null } }
function safeReadDir(p) { try { return fs.readdirSync(p) } catch (_) { return [] } }

// Recursively sum file sizes in a directory — capped at 200k files to avoid hanging
function getDirSize(dirPath, _count = { n: 0 }) {
  if (!dirPath || !fs.existsSync(dirPath)) return 0
  let total = 0
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (_count.n++ > 200000) break
      const full = path.join(dirPath, entry.name)
      try {
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory()) total += getDirSize(full, _count)
        else total += fs.statSync(full).size
      } catch (_) {}
    }
  } catch (_) {}
  return total
}

function tryRegistryKeys(key, hive) {
  try {
    const Registry = require('winreg')
    const h = hive || Registry.HKLM
    return new Promise(resolve => {
      new Registry({ hive: h, key }).keys((err, keys) => resolve(err ? [] : keys))
    })
  } catch (_) { return Promise.resolve([]) }
}

function tryRegistryValues(key, hive) {
  try {
    const Registry = require('winreg')
    const h = hive || Registry.HKLM
    return new Promise(resolve => {
      new Registry({ hive: h, key }).values((err, items) => {
        if (err) return resolve({})
        const map = {}
        items.forEach(i => { map[i.name] = i.value })
        resolve(map)
      })
    })
  } catch (_) { return Promise.resolve({}) }
}

function tryRegistryValue(key, name, hive) {
  try {
    const Registry = require('winreg')
    const h = hive || Registry.HKLM
    return new Promise(resolve => {
      new Registry({ hive: h, key }).get(name, (err, item) => resolve(err ? null : item.value))
    })
  } catch (_) { return Promise.resolve(null) }
}

function generateId(platform, rawId) {
  return `${platform.toLowerCase()}_${String(rawId).replace(/[^a-z0-9_]/gi, '_')}`
}

// ─── VDF parser ───────────────────────────────────────────────────────────────

function parseVdf(text) {
  const result = {}
  const stack  = [result]
  for (const raw of text.split('\n')) {
    const line  = raw.trim()
    const kvMatch  = line.match(/^"([^"]+)"\s+"([^"]*)"$/)
    const keyMatch = line.match(/^"([^"]+)"$/)
    if      (kvMatch)  stack[stack.length - 1][kvMatch[1]]  = kvMatch[2]
    else if (keyMatch) { const obj = {}; stack[stack.length - 1][keyMatch[1]] = obj; stack.push(obj) }
    else if (line === '}') stack.pop()
  }
  return result
}

// ─── Steam ────────────────────────────────────────────────────────────────────

// App IDs that are tools/SDKs/redistributables, never games
const STEAM_TOOL_IDS = new Set([
  // ── Hard blocks (user-specified) ──
  '228980',  // Steamworks Common Redistributables
  '250820',  // SteamVR

  // ── Steam runtimes & Proton versions ──
  '1070560', // Steam Linux Runtime
  '1391110', // Steam Linux Runtime - Soldier
  '1628350', // Steam Linux Runtime - Sniper
  '1887720', // Proton Experimental
  '2180100', // Proton Next
  '961940',  // Proton 3.7
  '1113280', // Proton 4.2
  '1245040', // Proton 5.0
  '1420170', // Proton 6.3
  '1580130', // Proton 7.0
  '2348590', // Proton 8.0
  '2805730', // Proton 9.0

  // ── Valve tools & SDKs ──
  '1091000', // Valve Steam Controller DB
  '365670',  // Steamworks SDK Redist
  '223850',  // SteamOS System Updater
  '353370',  // Steam Controller Configs
  '353380',  // HTC Vive USB Driver
  '358580',  // SteamVR Driver for Oculus
  '546560',  // HTC Vive Driver
  '719900',  // SteamVR Hardware Tests
  '1826330', // DirectX Shader Compiler
])

// Name patterns that indicate tools/framework items (case-insensitive)
const STEAM_TOOL_PATTERNS = [
  /^steamworks/i,
  /^steam linux runtime/i,
  /^proton\s/i,           // "Proton 7.0" etc but not a game called "Proton"
  /^proton$/i,
  /^proton experimental/i,
  /^steamvr/i,
  /redistributable/i,
  /^directx/i,
  /^microsoft visual c\+\+/i,
  /^vcredist/i,
  /^\.net framework/i,
  /^steam controller/i,
  /^valve steam/i,
]

function isSteamTool(appId, name) {
  if (STEAM_TOOL_IDS.has(String(appId))) return true
  if (!name) return false
  return STEAM_TOOL_PATTERNS.some(re => re.test(name))
}

async function scanSteam(sendProgress) {
  sendProgress('Scanning Steam...')
  const games = []

  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(os.homedir(), 'Steam'),
  ]
  let steamRoot = null
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'steamapps'))) { steamRoot = c; break }
  }
  if (!steamRoot) {
    const reg = await tryRegistryValue('\\SOFTWARE\\Valve\\Steam', 'InstallPath')
    if (reg && fs.existsSync(path.join(reg, 'steamapps'))) steamRoot = reg
  }
  if (!steamRoot) return { found: false, games }

  // Collect all library folders
  const libraryFolders = [path.join(steamRoot, 'steamapps')]
  const vdfText = safeRead(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'))
  if (vdfText) {
    const parsed = parseVdf(vdfText)
    const lf = parsed['libraryfolders'] || parsed['LibraryFolders'] || {}
    Object.values(lf).forEach(entry => {
      const p = typeof entry === 'object' ? entry.path : entry
      if (p && typeof p === 'string') {
        const ap = path.join(p, 'steamapps')
        if (fs.existsSync(ap)) libraryFolders.push(ap)
      }
    })
  }

  for (const folder of libraryFolders) {
    const files = safeReadDir(folder).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))
    for (const file of files) {
      const content = safeRead(path.join(folder, file))
      if (!content) continue
      const parsed = parseVdf(content)
      const app    = parsed['AppState'] || parsed['appstate'] || {}
      const appId  = String(app['appid'] || app['AppID'] || '')
      const name   = app['name'] || app['Name'] || ''
      const type   = (app['type'] || app['Type'] || '').toLowerCase()

      // Skip tools, configs, DLCs
      if (!appId || !name) continue
      if (isSteamTool(appId, name)) continue
      if (type && type !== 'game') continue

      const installDir = app['installdir'] || app['InstallDir']
      games.push({
        id:         generateId('steam', appId),
        title:      name,
        platform:   'Steam',
        appId,
        installDir: installDir ? path.join(folder, 'common', installDir) : null,
        sizeBytes:  parseInt(app['SizeOnDisk'] || app['sizeonDisk'] || '0', 10) || 0,
        launchUri:  `steam://rungameid/${appId}`,
        coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
  }

  sendProgress(`Steam: found ${games.length} games`)
  return { found: true, games }
}

// ─── Epic ─────────────────────────────────────────────────────────────────────

async function scanEpic(sendProgress) {
  sendProgress('Scanning Epic Games...')
  const games = []
  const manifestDir = path.join(
    process.env.PROGRAMDATA || 'C:\\ProgramData',
    'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'
  )
  if (!fs.existsSync(manifestDir)) return { found: false, games }

  for (const file of safeReadDir(manifestDir).filter(f => f.endsWith('.item'))) {
    const content = safeRead(path.join(manifestDir, file))
    if (!content) continue
    try {
      const data = JSON.parse(content)
      if (!data.DisplayName || !data.AppName) continue
      if (data.AppCategories && data.AppCategories.length > 0 && !data.AppCategories.some(c => c.toLowerCase().includes('game'))) continue
      games.push({
        id:         generateId('epic', data.AppName),
        title:      data.DisplayName,
        platform:   'Epic',
        appId:      data.AppName,
        installDir: data.InstallLocation || null,
        sizeBytes:  data.InstallLocation ? getDirSize(data.InstallLocation) : 0,
        launchUri:  `com.epicgames.launcher://apps/${data.AppName}?action=launch&silent=true`,
        coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    } catch (_) {}
  }

  sendProgress(`Epic: found ${games.length} games (calculated install sizes)`)
  return { found: true, games }
}

// ─── GOG + GOG Galaxy ─────────────────────────────────────────────────────────

async function scanGog(sendProgress) {
  sendProgress('Scanning GOG / GOG Galaxy...')
  const games    = []
  const seenIds  = new Set()

  // Registry paths to try — both standalone GOG and GOG Galaxy
  const regPaths = [
    '\\SOFTWARE\\GOG.com\\Games',
    '\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
  ]

  for (const regPath of regPaths) {
    const subkeys = await tryRegistryKeys(regPath)
    for (const subkey of subkeys) {
      const values = await tryRegistryValues(subkey.key)
      const gameId = (values['gameID'] || values['GAMEID'] || values['GameID'] || subkey.key.split('\\').pop() || '').trim()
      if (!gameId || seenIds.has(gameId)) continue
      seenIds.add(gameId)

      const name       = values['GAMENAME'] || values['gameName'] || values['GameName'] || values['ProductName'] || ''
      const exePath    = values['exe']      || values['EXE']      || values['Exe']      || ''
      const installDir = values['PATH']     || values['path']     || values['InstallDir'] || ''

      if (!name && !installDir) continue
      const title = name || path.basename(installDir)

      games.push({
        id:         generateId('gog', gameId),
        title,
        platform:   'GOG',
        appId:      String(gameId),
        installDir: installDir || null,
        sizeBytes:  installDir ? getDirSize(installDir) : 0,
        exePath:    exePath || null,
        launchUri:  `goggalaxy://openGame/${gameId}`,
        coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
  }

  // GOG Galaxy also writes installed game info under its own client key
  const galaxyPaths = [
    '\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\Games',
    '\\SOFTWARE\\GOG.com\\GalaxyClient\\Games',
  ]
  for (const regPath of galaxyPaths) {
    const subkeys = await tryRegistryKeys(regPath)
    for (const subkey of subkeys) {
      const values = await tryRegistryValues(subkey.key)
      const gameId = subkey.key.split('\\').pop()
      if (!gameId || seenIds.has(gameId)) continue
      seenIds.add(gameId)

      const name       = values['gameName'] || values['GameName'] || values['name'] || ''
      const installDir = values['path']     || values['installPath'] || values['installDir'] || ''
      if (!name && !installDir) continue

      games.push({
        id:         generateId('gog', gameId),
        title:      name || path.basename(installDir),
        platform:   'GOG',
        appId:      String(gameId),
        installDir: installDir || null,
        sizeBytes:  installDir ? getDirSize(installDir) : 0,
        exePath:    null,
        launchUri:  `goggalaxy://openGame/${gameId}`,
        coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
  }

  if (games.length === 0) return { found: false, games }
  sendProgress(`GOG: found ${games.length} games`)
  return { found: true, games }
}

// ─── Ubisoft Connect ──────────────────────────────────────────────────────────

async function scanUbisoft(sendProgress) {
  sendProgress('Scanning Ubisoft Connect...')
  const games = []

  const regPaths = [
    '\\SOFTWARE\\Ubisoft\\Launcher\\Installs',
    '\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
  ]

  for (const regPath of regPaths) {
    const subkeys = await tryRegistryKeys(regPath)
    for (const subkey of subkeys) {
      const values  = await tryRegistryValues(subkey.key)
      const gameId  = subkey.key.split('\\').pop()
      const installDir = values['InstallDir'] || values['installdir'] || ''
      if (!installDir) continue

      let name = null
      const rec = safeRead(path.join(installDir, 'uplay_record.json'))
      if (rec) { try { name = JSON.parse(rec).name } catch (_) {} }
      if (!name) name = path.basename(installDir)

      games.push({
        id:         generateId('ubisoft', gameId),
        title:      name,
        platform:   'Ubisoft',
        appId:      String(gameId),
        installDir: installDir || null,
        sizeBytes:  installDir ? getDirSize(installDir) : 0,
        launchUri:  `uplay://launch/${gameId}/0`,
        coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
    if (games.length > 0) break
  }

  if (games.length === 0) return { found: false, games }
  sendProgress(`Ubisoft: found ${games.length} games`)
  return { found: true, games }
}

// ─── EA App ───────────────────────────────────────────────────────────────────

async function scanEA(sendProgress) {
  sendProgress('Scanning EA App...')
  const games = []

  const manifestDirs = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EA Desktop', 'Manifests'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Origin', 'Manifests'),
  ]

  let found = false
  for (const dir of manifestDirs) {
    if (!fs.existsSync(dir)) continue
    found = true
    for (const file of safeReadDir(dir).filter(f => f.endsWith('.mfst'))) {
      const content = safeRead(path.join(dir, file))
      if (!content) continue
      try {
        const params    = new URLSearchParams(content)
        const contentId = params.get('id') || params.get('contentid')
        if (!contentId) continue
        const raw  = params.get('ddiassetid') || params.get('contentid') || file.replace('.mfst','')
        const name = raw.replace(/@.*/, '').replace(/_/g, ' ').trim()
        games.push({
          id:         generateId('ea', contentId),
          title:      name,
          platform:   'EA',
          appId:      contentId,
          installDir: params.get('dipinstallpath') || null,
          sizeBytes:  params.get('dipinstallpath') ? getDirSize(params.get('dipinstallpath')) : 0,
          launchUri:  `origin://launchgame/${contentId}`,
          coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
        })
      } catch (_) {}
    }
  }

  if (!found) {
    const regKeys = await tryRegistryKeys('\\SOFTWARE\\EA Games')
    if (regKeys.length) {
      found = true
      for (const key of regKeys) {
        const values     = await tryRegistryValues(key.key)
        const name       = key.key.split('\\').pop()
        const contentId  = values['ContentID'] || values['contentID'] || name
        const installDir = values['Install Dir'] || values['InstallDir'] || ''
        games.push({
          id:         generateId('ea', contentId),
          title:      name,
          platform:   'EA',
          appId:      contentId,
          installDir: installDir || null,
          sizeBytes:  installDir ? getDirSize(installDir) : 0,
          launchUri:  `origin://launchgame/${contentId}`,
          coverArt:   null, ocScore: null, ocTier: null, ocRecommend: null,
        })
      }
    }
  }

  if (!found || games.length === 0) return { found: false, games }
  sendProgress(`EA: found ${games.length} games`)
  return { found: true, games }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

async function scanAll(sendProgress) {
  const allGames          = []
  const launchersFound    = []
  const launchersNotFound = []

  const scanners = [
    { name: 'Steam',   fn: scanSteam   },
    { name: 'Epic',    fn: scanEpic    },
    { name: 'GOG',     fn: scanGog     },
    { name: 'Ubisoft', fn: scanUbisoft },
    { name: 'EA',      fn: scanEA      },
  ]

  for (const { name, fn } of scanners) {
    try {
      const result = await fn(sendProgress)
      if (result.found && result.games.length > 0) {
        launchersFound.push(name)
        allGames.push(...result.games)
      } else {
        launchersNotFound.push(name)
      }
    } catch (err) {
      launchersNotFound.push(name)
      sendProgress(`${name}: error – ${err.message}`)
    }
  }

  sendProgress(`Scan complete. ${allGames.length} games found.`)
  return {
    games: allGames,
    meta: { lastScan: new Date().toISOString(), launchersFound, launchersNotFound },
  }
}

module.exports = { scanAll }
