const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const DATA_DIR = app.getPath('userData')
const GAMES_FILE    = path.join(DATA_DIR, 'games.json')
const CONFIG_FILE   = path.join(DATA_DIR, 'config.json')
const META_FILE     = path.join(DATA_DIR, 'scanmeta.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

const DEFAULT_SETTINGS = {
  // Typography
  fontFamily:       'Segoe UI',
  fontSizeBase:     13,
  fontSizeTitle:    14,
  fontSizeLabel:    11,
  fontColorPrimary: '#d4d6e0',
  fontColorSecondary: '#7a7f9a',

  // Platform accent colours
  platformColors: {
    Steam:   { primary: '#1b9cd8', intensity: 0.12 },
    Epic:    { primary: '#2d9cdb', intensity: 0.12 },
    GOG:     { primary: '#9b59b6', intensity: 0.12 },
    Ubisoft: { primary: '#0070d1', intensity: 0.12 },
    EA:      { primary: '#f04e23', intensity: 0.12 },
  },

  // Grid
  cardSize: 'medium',       // small | medium | large
  showSizeOnCards: false,    // show install size badge on game cards
  showHiddenGames: false,    // reveal hidden games in the library
}

function readJson(filePath, defaultVal) {
  try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  catch (_) {}
  return defaultVal
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function getGames()       { return readJson(GAMES_FILE, []) }
function setGames(games)  { writeJson(GAMES_FILE, games) }

function getConfig() {
  return readJson(CONFIG_FILE, { sgdbApiKey: '', configured: false })
}
function setConfig(config) { writeJson(CONFIG_FILE, { ...config, configured: true }) }

function getScanMeta() {
  return readJson(META_FILE, { lastScan: null, launchersFound: [], launchersNotFound: [] })
}
function setScanMeta(meta) { writeJson(META_FILE, meta) }

function getSettings() {
  const saved = readJson(SETTINGS_FILE, {})
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    platformColors: { ...DEFAULT_SETTINGS.platformColors, ...(saved.platformColors || {}) },
  }
}
function setSettings(s) { writeJson(SETTINGS_FILE, s) }

const HIDDEN_FILE = path.join(DATA_DIR, 'hidden.json')

function getHiddenIds()           { return readJson(HIDDEN_FILE, []) }
function hideGame(id)             { const ids = new Set(getHiddenIds()); ids.add(id);     writeJson(HIDDEN_FILE, [...ids]) }
function unhideGame(id)           { const ids = new Set(getHiddenIds()); ids.delete(id); writeJson(HIDDEN_FILE, [...ids]) }

module.exports = { getGames, setGames, getConfig, setConfig, getScanMeta, setScanMeta, getSettings, setSettings, getHiddenIds, hideGame, unhideGame }
