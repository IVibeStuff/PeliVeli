const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')

// app.isPackaged is the reliable way to detect packaged vs dev in Electron
// NODE_ENV is not always set correctly by electron-builder

protocol.registerSchemesAsPrivileged([
  { scheme: 'peliveli', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#0c0e16',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1118',
      symbolColor: '#6b7280',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  protocol.handle('peliveli', (request) => {
    const filename = decodeURIComponent(request.url.replace('peliveli://covers/', ''))
    const fullPath = path.join(app.getPath('userData'), 'covers', filename)
    return net.fetch('file:///' + fullPath.replace(/\\/g, '/'))
  })

  createWindow()
  registerIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers() {
  const db = require('./db')
  const scanner = require('./scanner')
  const enricher = require('./enricher')

  ipcMain.handle('config:get', () => db.getConfig())
  ipcMain.handle('config:set', (_, config) => db.setConfig(config))

  ipcMain.handle('settings:get', () => db.getSettings())
  ipcMain.handle('settings:set', (_, settings) => db.setSettings(settings))

  ipcMain.handle('scanmeta:get', () => db.getScanMeta())

  ipcMain.handle('games:get', () => db.getGames())

  ipcMain.handle('fonts:list', async () => {
    try {
      const { execSync } = require('child_process')
      const output = execSync(
        'powershell -NoProfile -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.Drawing\') | Out-Null; [System.Drawing.FontFamily]::Families | Select-Object -ExpandProperty Name"',
        { timeout: 10000, encoding: 'utf8' }
      )
      return output.split('\n').map(f => f.trim()).filter(Boolean).sort()
    } catch (_) {
      return ['Arial','Calibri','Cambria','Georgia','Impact','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana']
    }
  })

  ipcMain.handle('games:scan', async (event) => {
    const sendProgress = (msg) => event.sender.send('scan:progress', msg)
    const results = await scanner.scanAll(sendProgress)
    db.setGames(results.games)
    db.setScanMeta(results.meta)
    return { games: results.games, meta: results.meta }
  })

  ipcMain.handle('games:enrich', async (event) => {
    const config = db.getConfig()
    const games = db.getGames()
    const sendProgress = (msg) => event.sender.send('enrich:progress', msg)
    const enriched = await enricher.enrichAll(games, config, sendProgress)
    db.setGames(enriched)
    return enriched
  })

  ipcMain.handle('games:reenrich', async (event) => {
    const config = db.getConfig()
    const games = db.getGames().map(g => ({
      ...g,
      coverArt:   null,
      ocScore:    null, ocTier: null, ocRecommend: null,
    }))
    const sendProgress = (msg) => event.sender.send('enrich:progress', msg)
    const enriched = await enricher.enrichAll(games, config, sendProgress)
    db.setGames(enriched)
    return enriched
  })

  // Refresh a single game's cover art and OC score
  ipcMain.handle('games:refreshOne', async (_, gameId) => {
    const config = db.getConfig()
    const games  = db.getGames()
    const game   = games.find(g => g.id === gameId)
    if (!game) return null

    // Use displayTitle (canonical name from OC) if available, else stored title
    const gameForFetch = { ...game, title: game.displayTitle || game.title }

    // Re-fetch cover art (clear cached art first so it re-downloads)
    if (game.coverArt) {
      try { fs.unlinkSync(game.coverArt) } catch (_) {}
    }
    const updatedGame = { ...gameForFetch, coverArt: null, ocScore: null, ocTier: null, ocRecommend: null }

    try {
      updatedGame.coverArt = await enricher.fetchCoverArt(updatedGame, config)
    } catch (_) {}

    // Re-fetch OC score — if they've set a manual ocUrl, use that ID directly
    try {
      const ocUrlMatch = (game.ocUrl || '').match(/opencritic\.com\/game\/(\d+)/)
      if (ocUrlMatch) {
        const ocData = await enricher.fetchOcById(ocUrlMatch[1])
        if (ocData) {
          updatedGame.ocScore     = ocData.ocScore
          updatedGame.ocTier      = ocData.ocTier
          updatedGame.ocRecommend = ocData.ocRecommend
          updatedGame.ocUrl       = ocData.ocUrl
        }
      } else {
        const oc = await enricher.fetchOcByTitle(updatedGame.title)
        if (oc) {
          updatedGame.ocScore     = oc.score
          updatedGame.ocTier      = oc.tier
          updatedGame.ocRecommend = oc.recommend
          updatedGame.ocUrl       = oc.url
        }
      }
    } catch (_) {}

    const newGames = games.map(g => g.id === gameId ? updatedGame : g)
    db.setGames(newGames)
    return updatedGame
  })
  ipcMain.handle('oc:fetchById', async (_, gameId) => {
    return enricher.fetchOcById(gameId)
  })

  // Save manually-set OC data back to a game, and fetch cover art using the canonical name
  ipcMain.handle('games:setOc', async (_, { id, ocScore, ocTier, ocRecommend, ocUrl, canonicalName }) => {
    const config = db.getConfig()
    let games = db.getGames()
    const game = games.find(g => g.id === id)
    if (!game) return null

    // Build the updated game — use canonical name from OC if we don't already have cover art
    const updatedGame = { ...game, ocScore, ocTier, ocRecommend, ocUrl }

    // If we got a proper name from OC and cover art is missing, try to fetch it now
    if (canonicalName && !updatedGame.coverArt) {
      const gameForCover = { ...updatedGame, title: canonicalName }
      try {
        const coverArt = await enricher.fetchCoverArt(gameForCover, config)
        if (coverArt) updatedGame.coverArt = coverArt
      } catch (_) {}
    }

    // Also store the canonical name so the grid/sort use the real title
    if (canonicalName && game.title !== canonicalName) {
      updatedGame.displayTitle = canonicalName  // keep original title for launch, show canonical in UI
    }

    games = games.map(g => g.id === id ? updatedGame : g)
    db.setGames(games)
    return updatedGame
  })

  // Hidden games
  ipcMain.handle('hidden:get',    ()       => db.getHiddenIds())
  ipcMain.handle('hidden:hide',   (_, id)  => { db.hideGame(id);   return db.getHiddenIds() })
  ipcMain.handle('hidden:unhide', (_, id)  => { db.unhideGame(id); return db.getHiddenIds() })

  // Debug log path (so user can open it to diagnose OC issues)
  ipcMain.handle('debug:logPath', () => {
    return require('path').join(app.getPath('userData'), 'enrich-debug.log')
  })

  ipcMain.handle('games:launch', async (_, game) => {
    try {
      if (game.launchUri) {
        await shell.openExternal(game.launchUri)
      } else if (game.exePath) {
        const { spawn } = require('child_process')
        spawn(game.exePath, [], { detached: true, stdio: 'ignore' }).unref()
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
