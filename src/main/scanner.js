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

// Recursively sum file sizes. Caps at 10,000 files to avoid hanging on huge installs.
function dirSize(dirPath, _count = { n: 0 }) {
  if (!dirPath || !fs.existsSync(dirPath)) return 0
  let total = 0
  let entries
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) } catch (_) { return 0 }
  for (const entry of entries) {
    if (_count.n++ > 10000) break
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory())   total += dirSize(full, _count)
    else if (entry.isFile()) { try { total += fs.statSync(full).size } catch (_) {} }
  }
  return total
}

function tryRegistry(hive, key, valueName) {
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive, key })
      reg.get(valueName, (err, item) => resolve(err ? null : item.value))
    })
  } catch (_) { return Promise.resolve(null) }
}

function tryRegistryKeys(hive, key) {
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive, key })
      reg.keys((err, keys) => resolve(err ? [] : keys))
    })
  } catch (_) { return Promise.resolve([]) }
}

function tryRegistryValues(hive, key) {
  try {
    const Registry = require('winreg')
    return new Promise((resolve) => {
      const reg = new Registry({ hive, key })
      reg.values((err, items) => {
        if (err) return resolve({})
        const map = {}
        items.forEach(i => { map[i.name] = i.value })
        resolve(map)
      })
    })
  } catch (_) { return Promise.resolve({}) }
}

function parseVdf(text) {
  const result = {}
  const stack = [result]
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const keyMatch = line.match(/^"([^"]+)"$/)
    const kvMatch  = line.match(/^"([^"]+)"\s+"([^"]*)"$/)
    if (kvMatch) {
      stack[stack.length - 1][kvMatch[1]] = kvMatch[2]
    } else if (keyMatch) {
      const obj = {}
      stack[stack.length - 1][keyMatch[1]] = obj
      stack.push(obj)
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
  const Registry = require('winreg')

  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(os.homedir(), 'Steam'),
    path.join(os.homedir(), 'AppData', 'Local', 'Steam'),
  ]

  let steamRoot = null
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'steamapps'))) { steamRoot = c; break }
  }

  if (!steamRoot) {
    for (const hive of [Registry.HKLM, Registry.HKCU]) {
      const regPath = await tryRegistry(hive, '\\SOFTWARE\\Valve\\Steam', 'InstallPath')
      if (regPath && fs.existsSync(path.join(regPath, 'steamapps'))) { steamRoot = regPath; break }
      const regPath32 = await tryRegistry(hive, '\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')
      if (regPath32 && fs.existsSync(path.join(regPath32, 'steamapps'))) { steamRoot = regPath32; break }
    }
  }

  if (!steamRoot) return { found: false, games }

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

  const vdfText = safeRead(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'))
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

  for (const folder of libraryFolders) {
    const files = safeReadDir(folder).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))
    for (const file of files) {
      const content = safeRead(path.join(folder, file))
      if (!content) continue
      const parsed = parseVdf(content)
      const app = parsed['AppState'] || parsed['appstate'] || {}
      const appId      = app['appid']      || app['AppID']
      const name       = app['name']       || app['Name']
      const installDir = app['installdir']
      if (!appId || !name) continue
      // Filter out tools, SDKs, redistributables and VR runtimes
      const appIdNum = parseInt(appId)
      const nameLower = name.toLowerCase()
      const isToolOrRedist = (
        nameLower.includes('redistributable') ||
        nameLower.includes('steamvr')         ||
        nameLower.includes('steam linux')     ||
        nameLower.includes('proton')          ||
        nameLower.includes('steam controller') ||
        nameLower === 'steamworks common redistributables' ||
        appIdNum === 228980  || // Steamworks Common Redistributables
        appIdNum === 1070560 || // Steam Linux Runtime
        appIdNum === 250820  || // SteamVR
        appIdNum === 1391110 || // Steam Linux Runtime - Soldier
        appIdNum === 1628350    // Steam Linux Runtime - Sniper
      )
      if (isToolOrRedist) continue
      games.push({
        id: generateId('steam', appId),
        title: name,
        platform: 'Steam',
        appId: String(appId),
        installDir: installDir ? path.join(folder, 'common', installDir) : null,
        sizeBytes: parseInt(app['SizeOnDisk'] || app['sizeonDisk'] || '0'),
        launchUri: `steam://rungameid/${appId}`,
        coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
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
      if (data.AppCategories && !data.AppCategories.includes('games')) continue
      games.push({
        id: generateId('epic', data.AppName),
        title: data.DisplayName,
        platform: 'Epic',
        appId: data.AppName,
        installDir: data.InstallLocation || null,
        sizeBytes: dirSize(data.InstallLocation || null),
        launchUri: `com.epicgames.launcher://apps/${data.AppName}?action=launch&silent=true`,
        coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    } catch (_) {}
  }

  sendProgress(`Epic: found ${games.length} games`)
  return { found: games.length > 0, games }
}

// ─── GOG ─────────────────────────────────────────────────────────────────────

async function scanGog(sendProgress) {
  sendProgress('Scanning GOG...')
  const games = []
  const Registry = require('winreg')

  const regCandidates = [
    { hive: Registry.HKLM, key: '\\SOFTWARE\\GOG.com\\Games' },
    { hive: Registry.HKLM, key: '\\SOFTWARE\\WOW6432Node\\GOG.com\\Games' },
    { hive: Registry.HKCU, key: '\\SOFTWARE\\GOG.com\\Games' },
    { hive: Registry.HKCU, key: '\\SOFTWARE\\WOW6432Node\\GOG.com\\Games' },
  ]

  const seenIds = new Set()

  for (const { hive, key } of regCandidates) {
    const subkeys = await tryRegistryKeys(hive, key)
    for (const subkey of subkeys) {
      const values     = await tryRegistryValues(hive, subkey.key)
      const gameId     = values['gameID'] || values['GAMEID'] || subkey.key.split('\\').pop()
      const name       = values['GAMENAME'] || values['gameName'] || values['GameName']
      const exePath    = values['exe']  || values['EXE']  || values['Exe']
      const installDir = values['PATH'] || values['path'] || values['InstallPath']

      if (!name || seenIds.has(String(gameId))) continue
      seenIds.add(String(gameId))

      games.push({
        id: generateId('gog', gameId),
        title: name,
        platform: 'GOG',
        appId: String(gameId),
        installDir: installDir || null,
        sizeBytes: dirSize(installDir || null),
        launchUri: `goggalaxy://rungameid/${gameId}`,
        exePath: exePath || null,
        coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
  }

  sendProgress(`GOG: found ${games.length} games`)
  return { found: games.length > 0, games }
}

// ─── Ubisoft Connect ─────────────────────────────────────────────────────────

async function scanUbisoft(sendProgress) {
  sendProgress('Scanning Ubisoft Connect...')
  const games = []
  const Registry = require('winreg')

  const regCandidates = [
    { hive: Registry.HKLM, key: '\\SOFTWARE\\Ubisoft\\Launcher\\Installs' },
    { hive: Registry.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs' },
    { hive: Registry.HKCU, key: '\\SOFTWARE\\Ubisoft\\Launcher\\Installs' },
  ]

  const seenIds = new Set()

  for (const { hive, key } of regCandidates) {
    const subkeys = await tryRegistryKeys(hive, key)
    for (const subkey of subkeys) {
      const values     = await tryRegistryValues(hive, subkey.key)
      const gameId     = subkey.key.split('\\').pop()
      const installDir = values['InstallDir'] || values['installdir']

      if (!installDir || seenIds.has(gameId)) continue
      seenIds.add(gameId)

      let name = null
      const content = safeRead(path.join(installDir, 'uplay_record.json'))
      if (content) { try { name = JSON.parse(content).name } catch (_) {} }
      if (!name) name = path.basename(installDir)

      games.push({
        id: generateId('ubisoft', gameId),
        title: name,
        platform: 'Ubisoft',
        appId: String(gameId),
        installDir,
        sizeBytes: dirSize(installDir),
        launchUri: `uplay://launch/${gameId}/0`,
        coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
      })
    }
  }

  sendProgress(`Ubisoft: found ${games.length} games`)
  return { found: games.length > 0, games }
}

// ─── EA App ──────────────────────────────────────────────────────────────────

async function scanEA(sendProgress) {
  sendProgress('Scanning EA App...')
  const games = []
  const Registry = require('winreg')

  const manifestDirs = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EA Desktop', 'Manifests'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Origin', 'Manifests'),
  ]

  let found = false
  const seenContentIds = new Set()
  for (const manifestDir of manifestDirs) {
    if (!fs.existsSync(manifestDir)) continue
    found = true
    const files = safeReadDir(manifestDir).filter(f => f.endsWith('.mfst'))
    for (const file of files) {
      const content = safeRead(path.join(manifestDir, file))
      if (!content) continue
      try {
        const params    = new URLSearchParams(content)
        const contentId = params.get('id') || params.get('contentid')
        const rawAssetId  = params.get('ddiassetid') || params.get('contentid') || file.replace('.mfst', '')
        const installPath = params.get('dipinstallpath') || ''
        // Prefer install folder name — it's human-readable ('Battlefield 6' not 'Battlefield6_BaseGame')
        const name = installPath
          ? path.basename(installPath)
          : rawAssetId.replace(/_BaseGame.*|_Standard.*|_Deluxe.*|_Premium.*/i, '').replace(/_/g, ' ').replace(/@.*/, '').trim()
        if (!contentId || seenContentIds.has(contentId)) continue
        seenContentIds.add(contentId)
        games.push({
          id: generateId('ea', contentId),
          title: name,
          platform: 'EA',
          appId: contentId,
          installDir: installPath || null,
          sizeBytes: dirSize(params.get('dipinstallpath') || null),
          launchUri: `origin://launchgame/${contentId}`,
          coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
        })
      } catch (_) {}
    }
  }

    if (!found) {
    const seenRegPaths={}, seenRegTitles={}
    for (const {hive,key} of [
      {hive:Registry.HKLM, key:"\\SOFTWARE\\EA Games"},
      {hive:Registry.HKLM, key:"\\SOFTWARE\\WOW6432Node\\EA Games"},
    ]) {
      const regKeys=await tryRegistryKeys(hive,key)
      if (!regKeys.length) continue
      found=true
      for (const rkey of regKeys) {
        const values=await tryRegistryValues(hive,rkey.key)
        const rawName=rkey.key.split("\\").pop()
        const installDir=values["Install Dir"]||values["InstallDir"]
        const contentId=values["ContentID"]||values["contentID"]||rawName
        const name=installDir?require("path").basename(installDir):rawName
        const ikey=installDir?installDir.toLowerCase():""
        const nt=name.toLowerCase().replace(/[^a-z0-9]/g,"")
        if (ikey&&seenRegPaths[ikey]) continue
        if (seenRegTitles[nt]) continue
        if (ikey) seenRegPaths[ikey]=true
        seenRegTitles[nt]=true
        games.push({id:generateId("ea",contentId),title:name,platform:"EA",appId:contentId,installDir:installDir||null,sizeBytes:dirSize(installDir||null),launchUri:"origin://launchgame/"+contentId,coverArt:null,ocScore:null,ocTier:null,ocRecommend:null})
      }
    }
  }

  sendProgress(`EA: found ${games.length} games`)
  return { found, games }
}

// ─── Main scan orchestrator ──────────────────────────────────────────────────

async function scanAll(sendProgress) {
  const allGames = []
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
      if (result.found) { launchersFound.push(name);    allGames.push(...result.games) }
      else              { launchersNotFound.push(name) }
    } catch (err) {
      launchersNotFound.push(name)
      sendProgress(`${name}: error – ${err.message}`)
    }
  }

  // Cross-platform dedup: EA Desktop registers ALL EA-connected games including those
  // bought on Steam/Epic/GOG. Remove EA entries where another platform already has the same title.
  function norm(t) {
    return (t || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const nonEaTitles = new Set(allGames.filter(g => g.platform !== 'EA').map(g => norm(g.title)))
  const deduped = allGames.filter(g => {
    if (g.platform !== 'EA') return true
    return !nonEaTitles.has(norm(g.title))
  })

  sendProgress(`Scan complete. ${deduped.length} games found.`)

  return {
    games: deduped,
    meta: { lastScan: new Date().toISOString(), launchersFound, launchersNotFound },
  }
}

module.exports = { scanAll }
