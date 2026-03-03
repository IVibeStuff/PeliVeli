const { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 600,
    backgroundColor: '#0c0e16',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f1118', symbolColor: '#6b7280', height: 36 },
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

function registerIpcHandlers() {
  const db       = require('./db')
  const scanner  = require('./scanner')
  const enricher = require('./enricher')

  ipcMain.handle('config:get',   ()     => db.getConfig())
  ipcMain.handle('config:set',   (_, c) => db.setConfig(c))
  ipcMain.handle('settings:get', ()     => db.getSettings())
  ipcMain.handle('settings:set', (_, s) => db.setSettings(s))

  // Update the Windows titlebar overlay colours to match the active theme
  ipcMain.handle('titlebar:setTheme', (_, { background, symbolColor }) => {
    try {
      if (mainWindow && mainWindow.setTitleBarOverlay) {
        mainWindow.setTitleBarOverlay({
          color: background || '#0f1118',
          symbolColor: symbolColor || '#6b7280',
          height: 36,
        })
      }
    } catch (_) {}
  })
  ipcMain.handle('scanmeta:get', ()     => db.getScanMeta())
  ipcMain.handle('games:get',    ()     => db.getGames())

  ipcMain.handle('fonts:list', async () => {
    try {
      const { execSync } = require('child_process')
      // Use registry query — works without System.Drawing assembly
      const out = execSync(
        'powershell -NoProfile -Command "Get-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\' | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name | ForEach-Object { ($_ -replace \'\\s*\\(.*\\)\',\'\').Trim() } | Sort-Object -Unique"',
        { timeout: 15000, encoding: 'utf8' }
      )
      const fonts = out.split('\n').map(f => f.trim()).filter(f => f.length > 1).sort()
      return fonts.length > 5 ? fonts : ['Calibri','Segoe UI','Arial','Tahoma','Verdana','Georgia','Consolas','Courier New','Trebuchet MS']
    } catch (_) {
      return ['Calibri','Segoe UI','Arial','Tahoma','Verdana','Georgia','Consolas','Courier New','Trebuchet MS']
    }
  })

  ipcMain.handle('games:scan', async (event) => {
    const send = (msg) => event.sender.send('scan:progress', msg)
    const results = await scanner.scanAll(send)
    db.setGames(results.games)
    db.setScanMeta(results.meta)
    return { games: results.games, meta: results.meta }
  })

  ipcMain.handle('games:enrich', async (event) => {
    const config = db.getConfig()
    const games  = db.getGames()
    const send   = (msg) => event.sender.send('enrich:progress', msg)
    const enriched = await enricher.enrichAll(games, config, send)
    db.setGames(enriched)
    return enriched
  })

  ipcMain.handle('games:reenrich', async (event) => {
    const config = db.getConfig()
    const games  = db.getGames().map(g => ({ ...g, coverArt: null, ocScore: null, ocTier: null, ocRecommend: null }))
    const send   = (msg) => event.sender.send('enrich:progress', msg)
    const enriched = await enricher.enrichAll(games, config, send)
    db.setGames(enriched)
    return enriched
  })

  ipcMain.handle('games:refreshOne', async (_, gameId) => {
    const config = db.getConfig()
    const games  = db.getGames()
    const game   = games.find(g => g.id === gameId)
    if (!game) return null
    if (game.coverArt) { try { fs.unlinkSync(game.coverArt) } catch (_) {} }
    const u = { ...game, title: game.displayTitle || game.title, coverArt: null, ocScore: null, ocTier: null, ocRecommend: null }
    try { u.coverArt = await enricher.fetchCoverArt(u, config) } catch (_) {}
    try {
      const m = (game.ocUrl || '').match(/opencritic\.com\/game\/(\d+)/)
      if (m) {
        const d = await enricher.fetchOcById(m[1])
        if (d) { u.ocScore = d.ocScore; u.ocTier = d.ocTier; u.ocRecommend = d.ocRecommend; u.ocUrl = d.ocUrl }
      } else {
        const oc = await enricher.fetchOcByTitle(u.title)
        if (oc) { u.ocScore = oc.score; u.ocTier = oc.tier; u.ocRecommend = oc.recommend; u.ocUrl = oc.url }
      }
    } catch (_) {}
    db.setGames(games.map(g => g.id === gameId ? u : g))
    return u
  })

  ipcMain.handle('oc:fetchById', async (_, gameId) => enricher.fetchOcById(gameId))

  ipcMain.handle('games:setOc', async (_, { id, ocScore, ocTier, ocRecommend, ocUrl, canonicalName }) => {
    const config = db.getConfig()
    let games = db.getGames()
    const game = games.find(g => g.id === id)
    if (!game) return null
    const u = { ...game, ocScore, ocTier, ocRecommend, ocUrl }
    if (canonicalName && !u.coverArt) {
      try { const c = await enricher.fetchCoverArt({ ...u, title: canonicalName }, config); if (c) u.coverArt = c } catch (_) {}
    }
    if (canonicalName && game.title !== canonicalName) u.displayTitle = canonicalName
    db.setGames(games.map(g => g.id === id ? u : g))
    return u
  })

  ipcMain.handle('hidden:get',    ()      => db.getHiddenIds())
  ipcMain.handle('hidden:hide',   (_, id) => { db.hideGame(id);   return db.getHiddenIds() })
  ipcMain.handle('hidden:unhide', (_, id) => { db.unhideGame(id); return db.getHiddenIds() })
  ipcMain.handle('debug:logPath', ()      => path.join(app.getPath('userData'), 'enrich-debug.log'))

  // ── Custom theme handlers ─────────────────────────────────────────────────
  const themesDir = path.join(app.getPath('userData'), 'themes')
  if (!fs.existsSync(themesDir)) fs.mkdirSync(themesDir, { recursive: true })

  ipcMain.handle('themes:getCustom', () => {
    try {
      return fs.readdirSync(themesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(themesDir, f), 'utf8'))
            return { ...raw, _filename: f, _custom: true }
          } catch (_) { return null }
        })
        .filter(Boolean)
    } catch (_) { return [] }
  })

  ipcMain.handle('themes:install', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Install PeliVeli Theme',
      filters: [{ name: 'PeliVeli Theme', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return { success: false, reason: 'cancelled' }
    const src = filePaths[0]
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(src, 'utf8'))
    } catch (_) {
      return { success: false, reason: 'invalid_json' }
    }
    if (!parsed.name || typeof parsed.name !== 'string') {
      return { success: false, reason: 'missing_name' }
    }
    const safeName = parsed.name.replace(/[^a-z0-9_\-\s]/gi, '_').trim()
    const destName = safeName + '.json'
    const dest = path.join(themesDir, destName)
    fs.copyFileSync(src, dest)
    return { success: true, filename: destName, theme: { ...parsed, _filename: destName, _custom: true } }
  })

  ipcMain.handle('themes:delete', (_, filename) => {
    try {
      const target = path.join(themesDir, path.basename(filename))
      if (fs.existsSync(target)) fs.unlinkSync(target)
      return { success: true }
    } catch (err) { return { success: false, reason: err.message } }
  })

  ipcMain.handle('themes:export', async (_, settings) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export PeliVeli Theme',
      defaultPath: (settings.name || 'my-theme') + '.json',
      filters: [{ name: 'PeliVeli Theme', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false, reason: 'cancelled' }
    const exportable = { ...settings }
    delete exportable._custom
    delete exportable._filename
    delete exportable.cardSize
    delete exportable.showSizeOnCards
    delete exportable.showHiddenGames
    delete exportable.scoreBadgeStyle
    fs.writeFileSync(filePath, JSON.stringify(exportable, null, 2), 'utf8')
    return { success: true, filePath }
  })

  ipcMain.handle('themes:getDir', () => themesDir)

  ipcMain.handle('shell:openExternal', (_, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url)
    }
  })

  ipcMain.handle('games:launch', async (_, game) => {
    try {
      if (game.launchUri)  { await shell.openExternal(game.launchUri) }
      else if (game.exePath) { const { spawn } = require('child_process'); spawn(game.exePath, [], { detached: true, stdio: 'ignore' }).unref() }
      return { success: true }
    } catch (err) { return { success: false, error: err.message } }
  })
}
