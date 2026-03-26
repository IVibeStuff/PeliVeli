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
    // Only clear cover art — keep existing OC scores so we don't hammer the API
    // for all 97+ games. Individual game refresh handles score re-fetching.
    const games  = db.getGames().map(g => ({ ...g, coverArt: null }))
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
    const u = { ...game, coverArt: null }
    try { u.coverArt = await enricher.fetchCoverArt(u, config) } catch (_) {}
    db.setGames(games.map(g => g.id === gameId ? u : g))
    return u
  })

  ipcMain.handle('games:setSgdb', async (_, { id, sgdbGameId }) => {
    const config = db.getConfig()
    const games  = db.getGames()
    const game   = games.find(g => g.id === id)
    if (!game) return null
    const result = await enricher.fetchCoverArtBySgdbId(game, sgdbGameId, config)
    if (!result) return { error: 'No cover art found for that SGDB game ID' }
    const u = { ...game, coverArt: result.coverPath }
    // If SGDB returned a canonical name, store it as displayTitle
    if (result.sgdbName && result.sgdbName !== game.title) u.displayTitle = result.sgdbName
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
  ipcMain.handle('games:addManual', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Game Executable',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    const exePath    = filePaths[0]
    const rawName    = path.basename(exePath, '.exe')
    const folderName = path.basename(path.dirname(exePath))
    const title      = (folderName && folderName !== '.') ? folderName : rawName
    const id         = 'other_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    const game = {
      id, title, platform: 'Other',
      appId: null, exePath, installDir: path.dirname(exePath),
      sizeBytes: 0, launchUri: null,
      coverArt: null, ocScore: null, ocTier: null, ocRecommend: null,
      ocUrl: null, displayTitle: null, manual: true,
    }
    const games = db.getGames()
    games.push(game)
    db.setGames(games)
    return game
  })

  ipcMain.handle('games:rename', async (_, { id, title }) => {
    const games = db.getGames()
    const idx   = games.findIndex(g => g.id === id)
    if (idx < 0) return null
    games[idx] = { ...games[idx], displayTitle: title.trim() || games[idx].title }
    db.setGames(games)
    return games[idx]
  })

  // ── Wishlist handlers ─────────────────────────────────────────────────────
  const wishlistSvc = require('./wishlist')

  ipcMain.handle('wishlist:get', () => db.getWishlist())

  ipcMain.handle('wishlist:add', async (_, item) => {
    const list = db.getWishlist()
    if (list.find(w => w.id === item.id)) return list
    const config = db.getConfig()
    const entry = {
      id: item.id,         // ITAD UUID
      name: item.name,
      itadId: item.id,     // keep explicit copy for price lookups
      addedAt: new Date().toISOString(),
      coverArt: null,
    }
    list.push(entry)
    db.setWishlist(list)
    // Fetch cover art in background so add feels instant
    ;(async () => {
      try {
        const fakeGame = { id: 'wish_' + item.id, title: item.name, platform: 'Other', appId: null, displayTitle: null }
        const coverPath = await enricher.fetchCoverArt(fakeGame, config)
        if (coverPath) entry.coverArt = coverPath
        const current = db.getWishlist()
        const idx = current.findIndex(w => w.id === item.id)
        if (idx >= 0) { current[idx] = { ...current[idx], ...entry }; db.setWishlist(current) }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('wishlist:enriched', db.getWishlist())
        }
      } catch (e) { console.error('[wishlist] enrich error:', e.message) }
    })()
    return list
  })

  ipcMain.handle('wishlist:remove', (_, id) => {
    const list = db.getWishlist().filter(w => w.id !== id)
    db.setWishlist(list)
    return list
  })

  ipcMain.handle('wishlist:find', (_, query) => {
    const config = db.getConfig()
    return wishlistSvc.findGames(query, config.itadApiKey)
  })

  ipcMain.handle('wishlist:prices', (_, { itadId, country }) => {
    const config = db.getConfig()
    return wishlistSvc.fetchPrices(itadId, country || 'EE', config.itadApiKey)
  })
}
