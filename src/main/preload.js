const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('peliVeli', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),

  getScanMeta: () => ipcRenderer.invoke('scanmeta:get'),

  getGames: () => ipcRenderer.invoke('games:get'),
  scanGames: () => ipcRenderer.invoke('games:scan'),
  enrichGames: () => ipcRenderer.invoke('games:enrich'),
  reEnrichGames: () => ipcRenderer.invoke('games:reenrich'),
  launchGame: (game) => ipcRenderer.invoke('games:launch', game),

  listFonts: () => ipcRenderer.invoke('fonts:list'),
  getDebugLogPath: () => ipcRenderer.invoke('debug:logPath'),

  getHiddenIds:  ()    => ipcRenderer.invoke('hidden:get'),
  hideGame:      (id)  => ipcRenderer.invoke('hidden:hide',   id),
  unhideGame:    (id)  => ipcRenderer.invoke('hidden:unhide', id),

  fetchOcById:      (gameId) => ipcRenderer.invoke('oc:fetchById',      gameId),
  setGameOc:        (data)   => ipcRenderer.invoke('games:setOc',        data),
  refreshOneGame:   (gameId) => ipcRenderer.invoke('games:refreshOne',   gameId),

  onScanProgress: (cb) => {
    const handler = (_, msg) => cb(msg)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },
  onEnrichProgress: (cb) => {
    const handler = (_, msg) => cb(msg)
    ipcRenderer.on('enrich:progress', handler)
    return () => ipcRenderer.removeListener('enrich:progress', handler)
  },
})
