import { useState, useContext } from 'react'
import { SettingsContext } from '../App.jsx'

function isLight(hex) {
  try {
    const c = (hex || '').replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
    return (r*299 + g*587 + b*114) / 1000 > 160
  } catch(_) { return false }
}

export default function DetailPanel({ game, isHidden, onClose, onLaunch, onHide, onUnhide, onSetSgdb, onRefresh, onRename }) {
  const [launching, setLaunching]       = useState(false)
  const [imgErr, setImgErr]             = useState(false)
  const [sgdbUrl, setSgdbUrl]           = useState('')
  const [sgdbFetching, setSgdbFetching] = useState(false)
  const [sgdbError, setSgdbError]       = useState('')
  const [sgdbSuccess, setSgdbSuccess]   = useState('')
  const [refreshing, setRefreshing]     = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState('')
  const s = useContext(SettingsContext)

  const font         = s.fontFamily || 'Calibri'
  const fontSizeBase  = s.fontSizeBase  || 13
  const fontSizeTitle = s.fontSizeTitle || 15
  const fontSizeLabel = s.fontSizeLabel || 11

  // Detect whether the overall theme is light by checking appBackground
  const lightPanel   = isLight(s.appBackground || '#0c0e16')
  // Background: light themes use appBackground; dark themes use drawerBackground
  const panelBg      = lightPanel ? (s.appBackground || '#f0ede6') : (s.drawerBackground || '#161820')
  // Text: light panel gets dark ink; dark panel gets the drawer's white/light colours
  const pri          = lightPanel ? '#1a1a14' : (s.drawerColorPrimary   || '#ffffff')
  const sec          = lightPanel ? '#5a5a4a' : (s.drawerColorSecondary || '#a0a8b8')

  // Chrome elements — borders, inputs, buttons — derived from lightPanel
  const tileNormalBg     = lightPanel ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.06)'
  const tileNormalBdr    = lightPanel ? 'rgba(0,0,0,0.18)'  : 'rgba(255,255,255,0.12)'
  const tileNormalColor  = lightPanel ? '#3a4a5a'           : '#6a90b8'
  const tileHoverBg      = lightPanel ? 'rgba(0,0,0,0.12)'  : 'rgba(74,128,192,0.15)'
  const tileHoverBdr     = lightPanel ? 'rgba(0,0,0,0.30)'  : 'rgba(74,128,192,0.4)'
  const tileHoverColor   = lightPanel ? '#1a1a14'           : '#90b8f0'
  const inputBg          = lightPanel ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.07)'
  const inputBdr         = lightPanel ? 'rgba(0,0,0,0.20)'  : 'rgba(255,255,255,0.12)'
  const fetchBg          = lightPanel ? 'rgba(0,0,0,0.10)'  : '#1e3060'
  const fetchBdr         = lightPanel ? 'rgba(0,0,0,0.25)'  : '#2a4080'
  const fetchColor       = lightPanel ? '#1a1a14'           : '#90b8f0'
  const launchBg         = lightPanel ? '#1a1a14'           : 'linear-gradient(135deg,#1e3a6e,#2e5fae)'
  const launchBdr        = lightPanel ? 'rgba(0,0,0,0.4)'   : '#2e5fae55'
  const launchColor      = lightPanel ? '#ffffff'           : '#a0c0f0'
  const coverPlaceBg     = lightPanel ? 'rgba(0,0,0,0.07)'  : '#1a1d28'
  const panelLeftBdr     = lightPanel ? 'rgba(0,0,0,0.12)'  : 'rgba(255,255,255,0.09)'

  async function handleLaunch() {
    setLaunching(true)
    await onLaunch(game)
    setTimeout(() => setLaunching(false), 2000)
  }

  async function handleFetchBySgdb() {
    const raw = sgdbUrl.trim()
    if (!raw) return
    const m = raw.match(/steamgriddb\.com\/game\/(\d+)|^(\d+)$/)
    if (!m) { setSgdbError('Paste a SteamGridDB game URL or just the numeric ID'); return }
    const sgdbGameId = m[1] || m[2]
    setSgdbFetching(true); setSgdbError(''); setSgdbSuccess('')
    try {
      const result = await onSetSgdb(game.id, sgdbGameId)
      if (result?.error) { setSgdbError(result.error); return }
      setSgdbSuccess(`Cover art updated${result?.displayTitle ? ` · "${result.displayTitle}"` : ''}`)
      setSgdbUrl('')
      setTimeout(() => setSgdbSuccess(''), 4000)
    } catch (err) {
      setSgdbError('Network error — check your connection')
    } finally {
      setSgdbFetching(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await onRefresh(game.id)
    setRefreshing(false)
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />

      <div style={{
        position: 'fixed', top: 136, right: 0, bottom: 0, width: 340,
        background: panelBg, borderLeft: `1px solid ${panelLeftBdr}`,
        borderTopLeftRadius: 14, zIndex: 100,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
        animation: 'slideInPanel 0.22s ease', fontFamily: font, color: pri,
      }}>
        <style>{`
          @keyframes spinBtn { to { transform: rotate(360deg); } }
          @keyframes slideInPanel { from { transform: translateX(30px); opacity: 0 } to { transform: none; opacity: 1 } }
          .close-x-btn { transform: scale(1); transition: transform 0.15s ease !important; }
          .close-x-btn:hover { transform: scale(1.18) !important; }
        `}</style>

        {/* Close button */}
        <button onClick={onClose} title="Close" className="close-x-btn" style={{
          position: 'absolute', top: 12, right: 12, width: 30, height: 30,
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', color: '#ffffff', fontSize: 17, cursor: 'pointer', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}>×</button>

        {/* Cover art */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '150%', background: coverPlaceBg, flexShrink: 0 }}>
          {game.coverArt && !imgErr
            ? <img src={`peliveli://covers/${encodeURIComponent(game.coverArt.split(/[\\/]/).pop())}`}
                alt={game.displayTitle || game.title}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setImgErr(true)} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 48, opacity: 0.12 }}>🎮</span>
              </div>
          }
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
            background: `linear-gradient(transparent, ${panelBg})` }} />
        </div>

        {/* Content */}
        <div style={{ padding: '12px 18px 24px', flex: 1 }}>

          {/* Title — click to rename */}
          {editingTitle ? (
            <div style={{ marginBottom: 14 }}>
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && titleDraft.trim()) {
                    onRename(game.id, titleDraft.trim())
                    setEditingTitle(false)
                  }
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                onBlur={() => {
                  if (titleDraft.trim()) onRename(game.id, titleDraft.trim())
                  setEditingTitle(false)
                }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontFamily: font, fontSize: fontSizeBase + 2,
                  color: pri, background: inputBg,
                  border: `1px solid ${inputBdr}`, borderRadius: 7,
                  padding: '6px 10px', outline: 'none', letterSpacing: '0.02em',
                }}
              />
              <div style={{ fontSize: fontSizeLabel - 1, color: sec, marginTop: 4, opacity: 0.6 }}>
                Enter to save · Esc to cancel
              </div>
            </div>
          ) : (
            <h2
              title="Click to rename"
              onClick={() => { setTitleDraft(game.displayTitle || game.title); setEditingTitle(true) }}
              style={{
                fontFamily: 'Bebas Neue, cursive', fontSize: 26, color: pri,
                margin: '0 0 14px', letterSpacing: '0.04em', lineHeight: 1.15,
                cursor: 'text',
              }}
            >
              {game.displayTitle || game.title}
              <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.3, fontFamily: font, fontWeight: 400, letterSpacing: 0 }}>✎</span>
            </h2>
          )}

          {/* Action tiles */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>

            {/* Refresh */}
            <button onClick={handleRefresh} disabled={refreshing} style={{
              flex: 1, padding: '9px 6px',
              background: tileNormalBg, border: `1px solid ${tileNormalBdr}`,
              borderRadius: 9, cursor: refreshing ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all 0.15s', color: refreshing ? sec : tileNormalColor }}
              onMouseEnter={e => { if (!refreshing) {
                e.currentTarget.style.background = tileHoverBg
                e.currentTarget.style.borderColor = tileHoverBdr
                e.currentTarget.style.color = tileHoverColor
              }}}
              onMouseLeave={e => {
                e.currentTarget.style.background = tileNormalBg
                e.currentTarget.style.borderColor = tileNormalBdr
                e.currentTarget.style.color = refreshing ? sec : tileNormalColor
              }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>
                {refreshing
                  ? <span style={{ display:'inline-block', width:14, height:14,
                      border:`2px solid ${lightPanel ? 'rgba(0,0,0,0.15)' : '#1e3060'}`,
                      borderTop:`2px solid ${lightPanel ? 'rgba(0,0,0,0.5)' : '#4a70ae'}`,
                      borderRadius:'50%', animation:'spinBtn 0.8s linear infinite' }} />
                  : '↺'}
              </span>
              <span style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'inherit', opacity: 0.7 }}>
                {refreshing ? 'Refreshing' : 'Refresh'}
              </span>
            </button>

            {/* Hide / Unhide */}
            <button onClick={() => isHidden ? onUnhide(game) : onHide(game)} style={{
              flex: 1, padding: '9px 6px',
              background: isHidden ? 'rgba(100,200,100,0.08)' : tileNormalBg,
              border: `1px solid ${isHidden ? 'rgba(100,200,100,0.25)' : tileNormalBdr}`,
              borderRadius: 9, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all 0.15s', color: isHidden ? '#4a9f4a' : tileNormalColor }}
              onMouseEnter={e => {
                if (isHidden) {
                  e.currentTarget.style.background = 'rgba(100,200,100,0.16)'
                  e.currentTarget.style.borderColor = 'rgba(100,200,100,0.5)'
                  e.currentTarget.style.color = '#3abf3a'
                } else {
                  e.currentTarget.style.background = lightPanel ? 'rgba(200,50,50,0.08)' : '#251a1a'
                  e.currentTarget.style.borderColor = 'rgba(220,80,80,0.4)'
                  e.currentTarget.style.color = '#e08080'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isHidden ? 'rgba(100,200,100,0.08)' : tileNormalBg
                e.currentTarget.style.borderColor = isHidden ? 'rgba(100,200,100,0.25)' : tileNormalBdr
                e.currentTarget.style.color = isHidden ? '#4a9f4a' : tileNormalColor
              }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{isHidden ? '◎' : '⊘'}</span>
              <span style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'inherit', opacity: 0.7 }}>
                {isHidden ? 'Unhide' : 'Hide game'}
              </span>
            </button>
          </div>

          {/* Cover Art — manual SGDB link */}
          {!game.coverArt && (
            <Section title="Cover Art" sec={sec}>
              <div style={{ fontSize:fontSizeLabel, color:sec, marginBottom:10, lineHeight:1.5 }}>
                No cover art found automatically. Paste a SteamGridDB game URL to fetch it manually.
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <input value={sgdbUrl} onChange={e=>setSgdbUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetchBySgdb()}
                  placeholder="steamgriddb.com/game/12345"
                  style={{ flex:1, background:inputBg, border:`1px solid ${inputBdr}`,
                    borderRadius:7, padding:'6px 10px', color:pri, fontSize:fontSizeLabel,
                    fontFamily:font, outline:'none' }} />
                <button onClick={handleFetchBySgdb} disabled={sgdbFetching} style={{
                  padding:'6px 10px', background:fetchBg, border:`1px solid ${fetchBdr}`,
                  borderRadius:7, color:sgdbFetching ? sec : fetchColor, fontSize:fontSizeLabel,
                  cursor:sgdbFetching ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                  {sgdbFetching ? '…' : '↓ Fetch'}
                </button>
              </div>
              {sgdbError && <div style={{ fontSize:fontSizeLabel, color:'#e05050', marginTop:5 }}>{sgdbError}</div>}
              {sgdbSuccess && <div style={{ fontSize:fontSizeLabel, color:'#50c878', marginTop:5 }}>{sgdbSuccess}</div>}
            </Section>
          )}

          {/* Cover art re-link when art exists */}
          {game.coverArt && (
            <Section title="Cover Art" sec={sec}>
              <div style={{ fontSize:fontSizeLabel, color:sec, marginBottom:8, opacity:0.7 }}>
                Re-link cover art via SteamGridDB:
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <input value={sgdbUrl} onChange={e=>setSgdbUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetchBySgdb()}
                  placeholder="steamgriddb.com/game/12345"
                  style={{ flex:1, background:inputBg, border:`1px solid ${inputBdr}`,
                    borderRadius:7, padding:'6px 10px', color:pri, fontSize:fontSizeLabel,
                    fontFamily:font, outline:'none' }} />
                <button onClick={handleFetchBySgdb} disabled={sgdbFetching} style={{
                  padding:'6px 10px', background:fetchBg, border:`1px solid ${fetchBdr}`,
                  borderRadius:7, color:sgdbFetching ? sec : fetchColor, fontSize:fontSizeLabel,
                  cursor:sgdbFetching ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                  {sgdbFetching ? '…' : '↓ Fetch'}
                </button>
              </div>
              {sgdbError && <div style={{ fontSize:fontSizeLabel, color:'#e05050', marginTop:5 }}>{sgdbError}</div>}
              {sgdbSuccess && <div style={{ fontSize:fontSizeLabel, color:'#50c878', marginTop:5 }}>{sgdbSuccess}</div>}
            </Section>
          )}

          {/* Details */}
          <Section title="Details" sec={sec}>
            <MetaRow label="Platform"     value={game.platform}          sec={sec} pri={pri} lsz={fontSizeLabel} vsz={fontSizeBase} />
            {game.installDir  && <MetaRow label="Install Path" value={game.installDir}          sec={sec} pri={pri} lsz={fontSizeLabel} vsz={fontSizeBase} mono />}
            {game.sizeBytes>0 && <MetaRow label="Size"         value={formatSize(game.sizeBytes)} sec={sec} pri={pri} lsz={fontSizeLabel} vsz={fontSizeBase} />}
            {game.appId       && <MetaRow label="App ID"       value={game.appId}               sec={sec} pri={pri} lsz={fontSizeLabel} vsz={fontSizeBase} mono />}
          </Section>

          {/* Launch */}
          <button onClick={handleLaunch} disabled={launching} style={{
            width:'100%', padding:'13px',
            background: launching ? tileNormalBg : launchBg,
            border: `1px solid ${launching ? tileNormalBdr : launchBdr}`,
            borderRadius:10, cursor: launching ? 'default' : 'pointer',
            color: launching ? sec : launchColor,
            fontFamily:"'Bebas Neue', cursive", fontSize:18, letterSpacing:'0.12em',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            transition:'all 0.2s', marginTop:4 }}>
            {launching ? <><BtnSpinner lightPanel={lightPanel} />LAUNCHING…</> : '▶  LAUNCH GAME'}
          </button>
        </div>
      </div>
    </>
  )
}

function Section({ title, children, sec }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize:9, color:sec, letterSpacing:'0.18em', textTransform:'uppercase',
        marginBottom:10, opacity:0.7 }}>{title}</div>
      {children}
    </div>
  )
}

function MetaRow({ label, value, sec, pri, lsz, vsz, mono }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'flex-start' }}>
      <span style={{ fontSize:lsz, color:sec, flexShrink:0, width:86, paddingTop:1 }}>{label}</span>
      <span style={{ fontSize:vsz, color:pri, wordBreak:'break-all', lineHeight:1.4,
        fontFamily: mono ? 'Consolas, monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

function BtnSpinner({ lightPanel }) {
  return <span style={{ display:'inline-block', width:14, height:14,
    border:`2px solid ${lightPanel ? 'rgba(0,0,0,0.15)' : '#1e2a40'}`,
    borderTop:`2px solid ${lightPanel ? 'rgba(0,0,0,0.55)' : '#4a70ae'}`,
    borderRadius:'50%', animation:'spinBtn 0.8s linear infinite' }} />
}

function formatSize(bytes) {
  if (!bytes) return null
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

