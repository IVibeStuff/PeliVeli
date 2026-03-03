import { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import GameGrid from './components/GameGrid.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import ProgressOverlay from './components/ProgressOverlay.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'
import SetupScreen from './components/SetupScreen.jsx'

export const SettingsContext = createContext({})

const DEFAULT_SETTINGS = {
  fontFamily: 'Calibri', fontSizeBase: 13, fontSizeTitle: 15, fontSizeLabel: 11,
  fontColorPrimary: '#ffffff', fontColorSecondary: '#a0a8b8',
  appBackground: '#0c0e16', topbarBackground: '#0f1118', sidebarBackground: '#0c0e16',
  drawerBackground: '#161820',
  drawerColorPrimary: '#ffffff', drawerColorSecondary: '#a0a8b8',
  borderColor: 'rgba(255,255,255,0.06)',
  cardSize: 'medium', showSizeOnCards: false, showHiddenGames: false, scoreBadgeStyle: 'pill',
  platformColors: {
    Steam:   { primary: '#1a9fff', intensity: 0.12 },
    Epic:    { primary: '#a0a0a0', intensity: 0.10 },
    GOG:     { primary: '#a855f7', intensity: 0.10 },
    Ubisoft: { primary: '#0070ff', intensity: 0.10 },
    EA:      { primary: '#ff6b35', intensity: 0.10 },
  }
}


// Derive whether a hex colour is light or dark, for titlebar symbol contrast
function isLightColor(hex) {
  const c = hex.replace('#','')
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
  return (r*299 + g*587 + b*114) / 1000 > 128
}

function applyTitlebarTheme(settings) {
  const bg = settings.topbarBackground || '#0f1118'
  const light = isLightColor(bg)
  window.peliVeli.setTitlebarTheme({
    background: bg,
    symbolColor: light ? '#1a1a14' : '#9aa0b0',
  }).catch(() => {})
}

export default function App() {
  const [games, setGames]               = useState([])
  const [hiddenIds, setHiddenIds]       = useState(new Set())
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [search, setSearch]             = useState('')
  const [sortBy, setSortBy]             = useState({ key: 'alpha', dir: 'asc' })
  const [status, setStatus]             = useState({ active: false, phase: '', message: '' })
  const [loading, setLoading]           = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [needsSetup, setNeedsSetup]     = useState(false)
  const [s, setS]                       = useState(DEFAULT_SETTINGS)
  const [customThemes, setCustomThemes] = useState([])

  useEffect(() => {
    async function boot() {
      const [savedGames, config, settingsRaw, hiddenArr, customThemesRaw] = await Promise.all([
        window.peliVeli.getGames(),
        window.peliVeli.getConfig(),
        window.peliVeli.getSettings(),
        window.peliVeli.getHiddenIds(),
        window.peliVeli.getCustomThemes(),
      ])
      const merged = { ...DEFAULT_SETTINGS, ...settingsRaw, platformColors: { ...DEFAULT_SETTINGS.platformColors, ...(settingsRaw.platformColors || {}) } }
      // Ensure drawerBackground always exists
      if (!merged.drawerBackground) merged.drawerBackground = '#161820'
      // Migrate old default font to Calibri
      if (!merged.fontFamily || merged.fontFamily === 'Segoe UI') merged.fontFamily = 'Calibri'
      setS(merged)
      applyTitlebarTheme(merged)
      setGames(savedGames)
      setCustomThemes(customThemesRaw || [])
      setHiddenIds(new Set(hiddenArr))
      if (!config.sgdbApiKey) setNeedsSetup(true)
      setLoading(false)
    }
    boot()
  }, [])

  async function handleScan() {
    const unsub1 = window.peliVeli.onScanProgress(msg => setStatus({ active: true, phase: 'scan', message: msg }))
    const unsub2 = window.peliVeli.onEnrichProgress(msg => setStatus({ active: true, phase: 'enrich', message: msg }))
    try {
      setStatus({ active: true, phase: 'scan', message: 'Starting scan...' })
      const result = await window.peliVeli.scanGames()
      setGames(result.games)
      setStatus({ active: true, phase: 'enrich', message: 'Fetching cover art and scores...' })
      const enriched = await window.peliVeli.enrichGames()
      setGames(enriched)
    } finally {
      setStatus({ active: false, phase: '', message: '' })
      unsub1(); unsub2()
    }
  }

  async function handleReEnrich() {
    const unsub = window.peliVeli.onEnrichProgress(msg => setStatus({ active: true, phase: 'enrich', message: msg }))
    try {
      setStatus({ active: true, phase: 'enrich', message: 'Re-fetching cover art and scores...' })
      const enriched = await window.peliVeli.reEnrichGames()
      setGames(enriched)
    } finally {
      setStatus({ active: false, phase: '', message: '' })
      unsub()
    }
  }

  async function handleSetOc(gameId, ocData) {
    const updated = await window.peliVeli.setGameOc({ id: gameId, ...ocData })
    if (updated) {
      setGames(gs => gs.map(g => g.id === gameId ? { ...g, ...updated } : g))
      setSelectedGame(g => g?.id === gameId ? { ...g, ...updated } : g)
    }
  }

  async function handleRefreshOne(gameId) {
    const updated = await window.peliVeli.refreshOneGame(gameId)
    if (updated) {
      setGames(gs => gs.map(g => g.id === gameId ? { ...g, ...updated } : g))
      setSelectedGame(g => g?.id === gameId ? { ...g, ...updated } : g)
    }
  }

  async function handleHideGame(game) {
    const updated = await window.peliVeli.hideGame(game.id)
    setHiddenIds(new Set(updated))
    setSelectedGame(null)
  }

  async function handleUnhideGame(game) {
    const updated = await window.peliVeli.unhideGame(game.id)
    setHiddenIds(new Set(updated))
  }

  function saveSettings(newS) {
    setS(newS)
    window.peliVeli.setSettings(newS)
    applyTitlebarTheme(newS)
  }

  const visibleGames = games.filter(g => s.showHiddenGames || !hiddenIds.has(g.id))

  const filteredGames = visibleGames
    .filter(g => {
      if (selectedPlatform !== 'All' && g.platform !== selectedPlatform) return false
      if (search && !(g.displayTitle || g.title).toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const ta = g => g.displayTitle || g.title
      let cmp = 0
      if      (sortBy.key === 'alpha')    cmp = ta(a).localeCompare(ta(b))
      else if (sortBy.key === 'platform') cmp = a.platform.localeCompare(b.platform) || ta(a).localeCompare(ta(b))
      else if (sortBy.key === 'size')     cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0)
      else if (sortBy.key === 'score')    cmp = (a.ocScore ?? -1) - (b.ocScore ?? -1)
      return sortBy.dir === 'asc' ? cmp : -cmp
    })

  const platformCounts = {}
  visibleGames.forEach(g => { platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1 })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0e16' }}>
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: '#333a50', letterSpacing: '0.15em' }}>LOADING PELIVELI...</span>
    </div>
  )

  if (needsSetup) return (
    <SetupScreen onComplete={async (key) => {
      await window.peliVeli.setConfig({ sgdbApiKey: key })
      setNeedsSetup(false)
    }} />
  )

  return (
    <SettingsContext.Provider value={s}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: s.appBackground || '#0c0e16', fontFamily: s.fontFamily || 'Segoe UI', color: s.fontColorPrimary || '#d4d6e0', overflow: 'hidden' }}>
        <TopBar
          search={search} onSearch={setSearch}
          sortBy={sortBy} onSort={(key) => setSortBy(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))}
          onScan={handleScan} scanning={status.active}
          gameCount={filteredGames.length} totalCount={visibleGames.length}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            selectedPlatform={selectedPlatform} onSelectPlatform={setSelectedPlatform}
            platformCounts={platformCounts} totalCount={visibleGames.length}
          />
          <GameGrid
            games={filteredGames} selectedGame={selectedGame}
            onSelectGame={setSelectedGame} hiddenIds={hiddenIds}
          />
          {selectedGame && (
            <DetailPanel
              game={selectedGame} isHidden={hiddenIds.has(selectedGame.id)}
              onClose={() => setSelectedGame(null)}
              onLaunch={g => window.peliVeli.launchGame(g)}
              onHide={handleHideGame} onUnhide={handleUnhideGame}
              onSetOc={handleSetOc} onRefresh={handleRefreshOne}
            />
          )}
        </div>
        {status.active && <ProgressOverlay message={status.message} phase={status.phase} />}
        {showSettings && (
          <SettingsDrawer
            settings={s} onSave={saveSettings} onClose={() => setShowSettings(false)}
            onReEnrich={handleReEnrich}
            onReconfigure={() => { setShowSettings(false); setNeedsSetup(true) }}
            customThemes={customThemes} onCustomThemesChange={setCustomThemes}
          />
        )}
      </div>
    </SettingsContext.Provider>
  )
}
