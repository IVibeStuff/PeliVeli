import { useState, useEffect, createContext } from 'react'
import SetupScreen from './components/SetupScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import GameGrid from './components/GameGrid.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import ProgressOverlay from './components/ProgressOverlay.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'

export const SettingsContext = createContext(null)

export const DEFAULT_SETTINGS = {
  fontFamily: 'Segoe UI',
  fontSizeBase: 13,
  fontSizeTitle: 14,
  fontSizeLabel: 11,
  fontColorPrimary: '#d4d6e0',
  fontColorSecondary: '#7a7f9a',
  platformColors: {
    Steam:   { primary: '#1b9cd8', intensity: 0.12 },
    Epic:    { primary: '#2d9cdb', intensity: 0.12 },
    GOG:     { primary: '#9b59b6', intensity: 0.12 },
    Ubisoft: { primary: '#0070d1', intensity: 0.12 },
    EA:      { primary: '#f04e23', intensity: 0.12 },
  },
  cardSize: 'medium',
  showSizeOnCards: false,
  showHiddenGames: false,
}

export default function App() {
  const [config, setConfig]             = useState(null)
  const [settings, setSettingsState]    = useState(DEFAULT_SETTINGS)
  const [games, setGames]               = useState([])
  const [hiddenIds, setHiddenIds]       = useState(new Set())
  const [meta, setMeta]                 = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [sort, setSort]     = useState({ key: 'alpha', dir: 'asc' })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState({ active: false, phase: '', message: '' })
  const [loading, setLoading]           = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    async function boot() {
      const cfg = await window.peliVeli.getConfig()
      setConfig(cfg)
      const sav = await window.peliVeli.getSettings()
      if (sav) setSettingsState(s => ({
        ...s, ...sav,
        platformColors: { ...s.platformColors, ...(sav.platformColors || {}) }
      }))
      setGames(await window.peliVeli.getGames())
      const ids = await window.peliVeli.getHiddenIds()
      setHiddenIds(new Set(ids || []))
      setMeta(await window.peliVeli.getScanMeta())
      setLoading(false)
    }
    boot()
  }, [])

  useEffect(() => {
    const u1 = window.peliVeli.onScanProgress(msg   => setStatus({ active: true, phase: 'scan',   message: msg }))
    const u2 = window.peliVeli.onEnrichProgress(msg => setStatus({ active: true, phase: 'enrich', message: msg }))
    return () => { u1(); u2() }
  }, [])

  async function saveSettings(ns) {
    setSettingsState(ns)
    await window.peliVeli.setSettings(ns)
  }

  async function handleSaveConfig(nc) {
    await window.peliVeli.setConfig(nc)
    setConfig({ ...nc, configured: true })
  }

  async function handleScan() {
    setStatus({ active: true, phase: 'scan', message: 'Starting scan...' })
    const result = await window.peliVeli.scanGames()
    setGames(result.games)
    setMeta(result.meta)
    setStatus({ active: true, phase: 'enrich', message: 'Fetching cover art and scores...' })
    const enriched = await window.peliVeli.enrichGames()
    setGames(enriched)
    setStatus({ active: false, phase: '', message: '' })
  }

  async function handleReEnrich() {
    setStatus({ active: true, phase: 'enrich', message: 'Re-fetching cover art and scores...' })
    const enriched = await window.peliVeli.reEnrichGames()
    setGames(enriched)
    setStatus({ active: false, phase: '', message: '' })
  }

  async function handleHideGame(game) {
    const newIds = await window.peliVeli.hideGame(game.id)
    setHiddenIds(new Set(newIds))
    setSelectedGame(null)
  }

  async function handleUnhideGame(game) {
    const newIds = await window.peliVeli.unhideGame(game.id)
    setHiddenIds(new Set(newIds))
    setSelectedGame(null)
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

  function handleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    )
  }

  const showHidden = settings.showHiddenGames

  const filteredGames = games
    .filter(g => {
      const isHidden = hiddenIds.has(g.id)
      if (isHidden && !showHidden) return false
      if (selectedPlatform !== 'All' && g.platform !== selectedPlatform) return false
      if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      if (sort.key === 'alpha')    cmp = a.title.localeCompare(b.title)
      if (sort.key === 'platform') cmp = a.platform.localeCompare(b.platform) || a.title.localeCompare(b.title)
      if (sort.key === 'size')     cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0)
      if (sort.key === 'score')    cmp = (a.ocScore ?? -1) - (b.ocScore ?? -1)
      return sort.dir === 'asc' ? cmp : -cmp
    })

  const platformCounts = {}
  games
    .filter(g => showHidden || !hiddenIds.has(g.id))
    .forEach(g => { platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1 })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1d27' }}>
      <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 24, color: '#4a5068', letterSpacing: '0.15em' }}>LOADING PELIVELI...</span>
    </div>
  )

  if (!config?.configured) return <SetupScreen onSave={handleSaveConfig} />

  const s = settings

  return (
    <SettingsContext.Provider value={s}>
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        background: '#1a1d27',
        fontFamily: s.fontFamily,
        color: s.fontColorPrimary,
        fontSize: s.fontSizeBase,
      }}>
        <Sidebar
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
          platformCounts={platformCounts}
          totalCount={games.filter(g => showHidden || !hiddenIds.has(g.id)).length}
          hiddenCount={hiddenIds.size}
          launchersNotFound={meta?.launchersNotFound || []}
          onOpenSettings={() => setShowSettings(true)}
          onScan={handleScan}
          scanning={status.active}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopBar
            search={search} onSearch={setSearch}
            sort={sort} onSort={handleSort}
            gameCount={filteredGames.length}
            totalCount={games.filter(g => showHidden || !hiddenIds.has(g.id)).length}
          />
          <GameGrid
            games={filteredGames}
            hiddenIds={hiddenIds}
            onSelect={setSelectedGame}
            selectedId={selectedGame?.id}
          />
        </div>

        {selectedGame && (
          <DetailPanel
            game={selectedGame}
            isHidden={hiddenIds.has(selectedGame.id)}
            onClose={() => setSelectedGame(null)}
            onLaunch={g => window.peliVeli.launchGame(g)}
            onHide={handleHideGame}
            onUnhide={handleUnhideGame}
            onSetOc={handleSetOc}
            onRefresh={handleRefreshOne}
          />
        )}
        {showSettings && (
          <SettingsDrawer
            settings={s} onSave={saveSettings} onClose={() => setShowSettings(false)}
            onReEnrich={() => { setShowSettings(false); handleReEnrich() }}
            onReconfigure={() => { setShowSettings(false); setConfig(c => ({ ...c, configured: false })) }}
          />
        )}
        {status.active && <ProgressOverlay phase={status.phase} message={status.message} />}
      </div>
    </SettingsContext.Provider>
  )
}
