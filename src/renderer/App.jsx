import { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import GameGrid from './components/GameGrid.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import ProgressOverlay from './components/ProgressOverlay.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import WishlistView from './components/WishlistView.jsx'

export const SettingsContext = createContext({})

const DEFAULT_SETTINGS = {
  fontFamily: 'Calibri', fontSizeBase: 13, fontSizeTitle: 15, fontSizeLabel: 11,
  fontColorPrimary: '#ffffff', fontColorSecondary: '#a0a8b8',
  appBackground: '#0c0e16', topbarBackground: '#0f1118', sidebarBackground: '#0c0e16',
  drawerBackground: '#161820',
  drawerColorPrimary: '#ffffff', drawerColorSecondary: '#a0a8b8',
  borderColor: 'rgba(255,255,255,0.06)',
  cardSize: 'medium', showSizeOnCards: false, showHiddenGames: false,
  wishlistCountry: 'EE',
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
  const [wishlist, setWishlist]         = useState([])
  const [view, setView]                 = useState('library') // 'library' | 'wishlist'
  const [hiddenIds, setHiddenIds]       = useState(new Set())
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [search, setSearch]             = useState('')
  const [sortBy, setSortBy]             = useState({ key: 'alpha', dir: 'asc' })
  const [status, setStatus]             = useState({ active: false, phase: '', message: '' })
  const [loading, setLoading]           = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [needsSetup, setNeedsSetup]     = useState(false)
  const [showItadSetup, setShowItadSetup] = useState(false)
  const [s, setS]                       = useState(DEFAULT_SETTINGS)
  const [customThemes, setCustomThemes] = useState([])

  useEffect(() => {
    async function boot() {
      const [savedGames, config, settingsRaw, hiddenArr, customThemesRaw, savedWishlist] = await Promise.all([
        window.peliVeli.getGames(),
        window.peliVeli.getConfig(),
        window.peliVeli.getSettings(),
        window.peliVeli.getHiddenIds(),
        window.peliVeli.getCustomThemes(),
        window.peliVeli.getWishlist(),
      ])
      const merged = { ...DEFAULT_SETTINGS, ...settingsRaw, platformColors: { ...DEFAULT_SETTINGS.platformColors, ...(settingsRaw.platformColors || {}) } }
      // Ensure drawerBackground always exists
      if (!merged.drawerBackground) merged.drawerBackground = '#161820'
      // Migrate old default font to Calibri
      if (!merged.fontFamily || merged.fontFamily === 'Segoe UI') merged.fontFamily = 'Calibri'
      // Migrate old wishlist settings
      if (!merged.wishlistCountry) merged.wishlistCountry = 'EE'
      setS(merged)
      applyTitlebarTheme(merged)
      setGames(savedGames)
      setWishlist(savedWishlist || [])
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

  async function handleSetSgdb(gameId, sgdbGameId) {
    const result = await window.peliVeli.setSgdb(gameId, sgdbGameId)
    if (result && !result.error) {
      setGames(gs => gs.map(g => g.id === gameId ? { ...g, ...result } : g))
      setSelectedGame(g => g?.id === gameId ? { ...g, ...result } : g)
    }
    return result
  }

  async function handleRefreshOne(gameId) {
    const updated = await window.peliVeli.refreshOneGame(gameId)
    if (updated) {
      setGames(gs => gs.map(g => g.id === gameId ? { ...g, ...updated } : g))
      setSelectedGame(g => g?.id === gameId ? { ...g, ...updated } : g)
    }
  }

  async function handleAddToWishlist(item) {
    const updated = await window.peliVeli.addToWishlist(item)
    setWishlist(updated)
  }

  // Listen for background enrichment completing after wishlist add
  useEffect(() => {
    const unsub = window.peliVeli.onWishlistEnriched(updated => setWishlist(updated))
    return unsub
  }, [])

  async function handleRemoveFromWishlist(id) {
    const updated = await window.peliVeli.removeFromWishlist(id)
    setWishlist(updated)
  }

  async function handleAddGame() {
    const game = await window.peliVeli.addManualGame()
    if (game) {
      setGames(gs => [...gs, game])
      setSelectedGame(game)
    }
  }

  async function handleRenameGame(gameId, title) {
    const updated = await window.peliVeli.renameGame(gameId, title)
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
          onScan={handleScan} onAddGame={handleAddGame} scanning={status.active}
          gameCount={filteredGames.length} totalCount={visibleGames.length}
          onOpenSettings={() => setShowSettings(true)}
          view={view}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            selectedPlatform={selectedPlatform} onSelectPlatform={p => { setView('library'); setSelectedPlatform(p) }}
            platformCounts={platformCounts} totalCount={visibleGames.length}
            view={view} onSelectView={setView}
            wishlistCount={wishlist.length}
          />
          {view === 'wishlist' ? (
            <WishlistView
              wishlist={wishlist}
              onAdd={handleAddToWishlist}
              onRemove={handleRemoveFromWishlist}
              country={s.wishlistCountry || 'EE'}
            />
          ) : (
            <>
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
              onSetSgdb={handleSetSgdb} onRefresh={handleRefreshOne} onRename={handleRenameGame}
                />
              )}
            </>
          )}
        </div>
        {status.active && <ProgressOverlay message={status.message} phase={status.phase} />}
        {showSettings && (
          <SettingsDrawer
            settings={s} onSave={saveSettings} onClose={() => setShowSettings(false)}
            onReEnrich={handleReEnrich}
            onReconfigure={() => { setShowSettings(false); setNeedsSetup(true) }}
            onReconfigureItad={() => { setShowSettings(false); setShowItadSetup(true) }}
            customThemes={customThemes} onCustomThemesChange={setCustomThemes}
          />
        )}
        {showItadSetup && (
          <ItadKeyModal
            onComplete={async (key) => {
              if (key) await window.peliVeli.setConfig({ ...(await window.peliVeli.getConfig()), itadApiKey: key })
              setShowItadSetup(false)
            }}
          />
        )}
      </div>
    </SettingsContext.Provider>
  )
}

function ItadKeyModal({ onComplete }) {
  const [key, setKey] = useState('')
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:500,
      background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        width:460, background:'#0f1118',
        border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:14, padding:'36px 36px 32px',
        boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:22, color:'#e8eaf0',
          letterSpacing:'0.1em', marginBottom:8 }}>IsThereAnyDeal API Key</div>
        <p style={{ fontSize:13, color:'#8090a8', lineHeight:1.6, marginBottom:6 }}>
          Required for Wishlist price lookups. Register a free app at:
        </p>
        <div style={{ fontSize:12, color:'#6aa0e0', marginBottom:24, letterSpacing:'0.03em' }}>
          isthereanydeal.com/apps/my/
        </div>
        <label style={{ display:'block', fontSize:11, color:'#8090a8',
          letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>
          API Key
        </label>
        <input
          autoFocus
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && key.trim()) onComplete(key.trim()) }}
          placeholder="Paste your ITAD API key here"
          style={{
            width:'100%', boxSizing:'border-box', padding:'10px 14px',
            background:'#171922', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, color:'#c8cad8', fontSize:13,
            letterSpacing:'0.03em', outline:'none', marginBottom:24,
          }}
        />
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onComplete(null)} style={{
            flex:1, padding:'11px',
            background:'transparent', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:9, color:'#8090a8', fontSize:13, cursor:'pointer',
          }}>Cancel</button>
          <button onClick={() => { if (key.trim()) onComplete(key.trim()) }} disabled={!key.trim()} style={{
            flex:2, padding:'11px',
            background: key.trim() ? 'linear-gradient(135deg,#1e3a6e,#2e5fae)' : '#141620',
            border:`1px solid ${key.trim() ? '#2e5fae' : '#1e2030'}`,
            borderRadius:9, color: key.trim() ? '#90b8f0' : '#6070a0',
            fontFamily:"'Bebas Neue',cursive", fontSize:17, letterSpacing:'0.1em',
            cursor: key.trim() ? 'pointer' : 'default', transition:'all 0.2s',
          }}>Save Key</button>
        </div>
      </div>
    </div>
  )
}
