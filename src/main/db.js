const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const DATA_DIR     = app.getPath('userData')
const GAMES_FILE   = path.join(DATA_DIR, 'games.json')
const CONFIG_FILE  = path.join(DATA_DIR, 'config.json')
const META_FILE    = path.join(DATA_DIR, 'scanmeta.json')
const SETTINGS_FILE= path.join(DATA_DIR, 'settings.json')
const HIDDEN_FILE  = path.join(DATA_DIR, 'hidden.json')

function read(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (_) { return def }
}
function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

module.exports = {
  getGames:    ()  => read(GAMES_FILE, []),
  setGames:    (g) => write(GAMES_FILE, g),
  getConfig:   ()  => read(CONFIG_FILE, {}),
  setConfig:   (c) => write(CONFIG_FILE, c),
  getScanMeta: ()  => read(META_FILE, null),
  setScanMeta: (m) => write(META_FILE, m),
  getSettings: ()  => read(SETTINGS_FILE, {}),
  setSettings: (s) => write(SETTINGS_FILE, s),
  getHiddenIds:()  => read(HIDDEN_FILE, []),
  hideGame:    (id)=> { const h = read(HIDDEN_FILE, []); if (!h.includes(id)) { h.push(id); write(HIDDEN_FILE, h) } },
  unhideGame:  (id)=> write(HIDDEN_FILE, read(HIDDEN_FILE, []).filter(x => x !== id)),
}
