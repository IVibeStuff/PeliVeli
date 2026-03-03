const fs = require('fs')
const path = require('path')
const os = require('os')

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch (_) { return null }
}

function safeReadDir(dirPath) {
  try { return fs.readdirSync(dirPath) } catch (_) { return [] }
}

function tryRegistry(key, valueName) {
  // Synchronous registry read via winreg - wrapped in try/catch
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive: Registry.HKLM, key })
      reg.get(valueName, (err, item) => {
        resolve(err ? null : item.value)
      })
    })
  } catch (_) {
    return Promise.resolve(null)
  }
}

function tryRegistryKeys(key) {
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive: Registry.HKLM, key })
      reg.keys((err, keys) => resolve(err ? [] : keys))
    })
  } catch (_) {
    return Promise.resolve([])
  }
}

function tryRegistryValues(key) {
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive: Registry.HKLM, key })
      reg.values((err, items) => {
        if (err) return resolve({})
        const map = {}
        items.forEach(i => { map[i.name] = i.value })
        resolve(map)
      })
    })
  } catch (_) {
    return Promise.resolve({})
  }
}

function parseVdf(text) {
  // Minimal VDF parser for Steam files
  const result = {}
  const stack = [result]
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const keyMatch = line.match(/^"([^"]+)"$/)
    const kvMatch = line.match(/^"([^"]+)"\s+"([^"]*)"$/)
    if (kvMatch) {
      stack[stack.length - 1][kvMatch[1]] = kvMatch[2]
    } else if (keyMatch) {
      const obj = {}
      stack[stack.length - 1][keyMatch[1]] = obj
      stack.push(obj)
    } else if (line === '{') {
      // already pushed
    } else if (line === '}') {
      stack.pop()
    }
    i++
  }
  return result
}

function generateId(platform, rawId) {
  return `${platform.toLowerCase()}_${rawId}`
}

// ─── Steam ───────────────────────────────────────────────────────────────────

async function scanSteam(sendProgress) {
  sendProgress('Scanning Steam...')
  const games = []

  // Common Steam install locations
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(os.homedir(), 'Steam'),
  ]

  let steamRoot = null
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'steamapps'))) {
      steamRoot = c
      break
    }
  }

  // Also try registry
  if (!steamRoot) {
    const regPath = await tryRegistry('\\SOFTWARE\\Valve\\Steam', 'InstallPath')
    if (regPath && fs.existsSync(path.join(regPath, 'steamapps'))) {
      steamRoot = regPath
    }
  }

  if (!steamRoot) return { found: false, games }

  // Find all library folders.
  // Use a normalised Set to prevent duplicates: Steam's libraryfolders.vdf always
  // lists the default steamapps path as entry 0, so without dedup every game in
  // the primary library appears twice.
  const seenFolders = new Set()
  const libraryFolders = []
  function addLibFolder(p) {
    const norm = path.normalize(p).toLowerCase()
    if (!seenFolders.has(norm) && fs.existsSync(p)) {
      seenFolders.add(norm)
      libraryFolders.push(p)
    }
  }
  addLibFolder(path.join(steamRoot, 'steamapps'))

  const vdfPath = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf')
  const vdfText = safeRead(vdfPath)
  if (vdfText) {
    const parsed = parseVdf(vdfText)
    const lf = parsed['libraryfolders'] || parsed['LibraryFolders'] || {}
    Object.values(lf).forEach(entry => {
      if (typeof entry === 'object' && entry.path) {
        addLibFolder(path.join(entry.path, 'steamapps'))
      } else if (typeof entry === 'string') {
        addLibFolder(path.join(entry, 'steamapps'))
      }
    })
  }

  // Parse appmanifests
  for (const folder of libraryFolders) {
    const files = safeReadDir(folder).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))
    for (const file of files) {
      const content = safeRead(path.join(folder, file))
      if (!content) continue
      const parsed = parseVdf(content)
      const app = parsed['AppState'] || parsed['appstate'] || {}
      const appId = app['appid'] || app['AppID']
      const name = app['name'] || app['Name']
      const installDir = app['installdir']
      if (!appId || !name) continue
      // Skip non-game entries (tools, SDKs, etc.) — they usually have very low appids or specific names
      games.push({
        id: generateId('steam', appId),
        title: name,
        platform: 'Steam',
        appId: String(appId),
        installDir: installDir ? path.join(folder, 'common', installDir) : null,
        sizeBytes: parseInt(app['SizeOnDisk'] || app['sizeonDisk'] || '0'),
        launchUri: `steam://rungameid/${appId}`,
        coverArt: null,
        ocScore: null,
        ocTier: null,
        ocRecommend: null,
      })
    }
  }

  sendProgress(`Steam: found ${games.length} games`)
  return { found: true, games }
}

// ─── Epic Games ──────────────────────────────────────────────────────────────

async function scanEpic(sendProgress) {
  sendProgress('Scanning Epic Games...')
  const games = []

  const manifestDir = path.join(
    process.env.PROGRAMDATA || 'C:\\ProgramData',
    'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'
  )

  if (!fs.existsSync(manifestDir)) return { found: false, games }

  const files = safeReadDir(manifestDir).filter(f => f.endsWith('.item'))
  for (const file of files) {
    const content = safeRead(path.join(manifestDir, file))
    if (!content) continue
    try {
      const data = JSON.parse(content)
      if (!data.DisplayName || !data.AppName) continue
      // Skip engine / non-game items
      if (data.AppCategories && !data.AppCategories.includes('games')) continue
      games.push({
        id: generateId('epic', data.AppName),
        title: data.DisplayName,
        platform: 'Epic',
        appId: data.AppName,
        installDir: data.InstallLocation || null,
        sizeBytes: 0,
        launchUri: `com.epicgames.launcher://apps/${data.AppName}?action=launch&silent=true`,
        coverArt: null,
        ocScore: null,
        ocTier: null,
        ocRecommend: null,
      })
    } catch (_) {}
  }

  sendProgress(`Epic: found ${games.length} games`)
  return { found: true, games }
}

// ─── GOG ─────────────────────────────────────────────────────────────────────

async function scanGog(sendProgress) {
  sendProgress('Scanning GOG...')
  const games = []

  const subkeys = await tryRegistryKeys('\\SOFTWARE\\GOG.com\\Games')
  if (!subkeys.length) return { found: false, games }

  for (const subkey of subkeys) {
    const values = await tryRegistryValues(subkey.key)
    const gameId = values['gameID'] || values['GAMEID'] || subkey.key.split('\\').pop()
    const name = values['GAMENAME'] || values['gameName'] || values['GameName']
    const exePath = values['exe'] || values['EXE'] || values['Exe']
    const installDir = values['PATH'] || values['path']
    if (!name) continue
    games.push({
      id: generateId('gog', gameId),
      title: name,
      platform: 'GOG',
      appId: String(gameId),
      installDir: installDir || null,
      sizeBytes: 0,
      exePath: exePath || null,
      launchUri: null, // GOG uses direct exe
      coverArt: null,
      ocScore: null,
      ocTier: null,
      ocRecommend: null,
    })
  }

  sendProgress(`GOG: found ${games.length} games`)
  return { found: games.length > 0, games }
}

// ─── Ubisoft Connect ─────────────────────────────────────────────────────────

async function scanUbisoft(sendProgress) {
  sendProgress('Scanning Ubisoft Connect...')
  const games = []

  const subkeys = await tryRegistryKeys('\\SOFTWARE\\Ubisoft\\Launcher\\Installs')
  if (!subkeys.length) {
    // Try 64-bit path
    const subkeys64 = await tryRegistryKeys('\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs')
    if (!subkeys64.length) return { found: false, games }
    subkeys.push(...subkeys64)
  }

  for (const subkey of subkeys) {
    const values = await tryRegistryValues(subkey.key)
    const gameId = subkey.key.split('\\').pop()
    const installDir = values['InstallDir'] || values['installdir']
    if (!installDir) continue

    // Try to get the name from the install folder or a local manifest
    let name = null
    const nameCandidates = [
      path.join(installDir, 'uplay_record.json'),
    ]
    for (const nc of nameCandidates) {
      const content = safeRead(nc)
      if (content) {
        try { name = JSON.parse(content).name } catch (_) {}
        if (name) break
      }
    }
    // Fallback: use the folder name
    if (!name) name = path.basename(installDir)

    games.push({
      id: generateId('ubisoft', gameId),
      title: name,
      platform: 'Ubisoft',
      appId: String(gameId),
      installDir: installDir || null,
      sizeBytes: 0,
      launchUri: `uplay://launch/${gameId}/0`,
      coverArt: null,
      ocScore: null,
      ocTier: null,
      ocRecommend: null,
    })
  }

  sendProgress(`Ubisoft: found ${games.length} games`)
  return { found: games.length > 0, games }
}

// ─── EA App ──────────────────────────────────────────────────────────────────

async function scanEA(sendProgress) {
  sendProgress('Scanning EA App...')
  const games = []

  const manifestDirs = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EA Desktop', 'Manifests'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Origin', 'Manifests'), // legacy
  ]

  let found = false
  for (const manifestDir of manifestDirs) {
    if (!fs.existsSync(manifestDir)) continue
    found = true
    const files = safeReadDir(manifestDir).filter(f => f.endsWith('.mfst'))
    for (const file of files) {
      const content = safeRead(path.join(manifestDir, file))
      if (!content) continue
      try {
        // EA manifests are query-string encoded
        const params = new URLSearchParams(content)
        const contentId = params.get('id') || params.get('contentid')
        const name = params.get('ddiassetid') || params.get('contentid') || file.replace('.mfst', '')
        if (!contentId) continue
        games.push({
          id: generateId('ea', contentId),
          title: name.replace(/@.*/, '').replace(/_/g, ' '), // clean up id-based name
          platform: 'EA',
          appId: contentId,
          installDir: params.get('dipinstallpath') || null,
          sizeBytes: 0,
          launchUri: `origin://launchgame/${contentId}`,
          coverArt: null,
          ocScore: null,
          ocTier: null,
          ocRecommend: null,
          needsEnrichment: true, // EA names from manifests are often ugly, IGDB will clean up
        })
      } catch (_) {}
    }
  }

  // Also check registry for EA
  if (!found) {
    const regKeys = await tryRegistryKeys('\\SOFTWARE\\EA Games')
    if (regKeys.length) {
      found = true
      for (const key of regKeys) {
        const values = await tryRegistryValues(key.key)
        const name = key.key.split('\\').pop()
        const installDir = values['Install Dir'] || values['InstallDir']
        const contentId = values['ContentID'] || values['contentID'] || name
        games.push({
          id: generateId('ea', contentId),
          title: name,
          platform: 'EA',
          appId: contentId,
          installDir: installDir || null,
          sizeBytes: 0,
          launchUri: `origin://launchgame/${contentId}`,
          coverArt: null,
          ocScore: null,
          ocTier: null,
          ocRecommend: null,
        })
      }
    }
  }

  sendProgress(`EA: found ${games.length} games`)
  return { found, games }
}

// ─── Main scan orchestrator ──────────────────────────────────────────────────

async function scanAll(sendProgress) {
  const allGames = []
  const launchersFound = []
  const launchersNotFound = []

  const scanners = [
    { name: 'Steam', fn: scanSteam },
    { name: 'Epic', fn: scanEpic },
    { name: 'GOG', fn: scanGog },
    { name: 'Ubisoft', fn: scanUbisoft },
    { name: 'EA', fn: scanEA },
  ]

  for (const { name, fn } of scanners) {
    try {
      const result = await fn(sendProgress)
      if (result.found) {
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
    meta: {
      lastScan: new Date().toISOString(),
      launchersFound,
      launchersNotFound,
    },
  }
}

module.exports = { scanAll }
