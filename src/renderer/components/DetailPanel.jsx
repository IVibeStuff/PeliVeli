import { useState, useContext } from 'react'
import { SettingsContext } from '../App.jsx'

export default function DetailPanel({ game, isHidden, onClose, onLaunch, onHide, onUnhide, onSetOc, onRefresh }) {
  const [launching, setLaunching]   = useState(false)
  const [imgErr, setImgErr]         = useState(false)
  const [ocUrl, setOcUrl]           = useState('')
  const [ocFetching, setOcFetching] = useState(false)
  const [ocError, setOcError]       = useState('')
  const [ocSuccess, setOcSuccess]   = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const s = useContext(SettingsContext)

  const font        = s.fontFamily         || 'Segoe UI'
  const textPrimary = s.fontColorPrimary   || '#d4d6e0'
  const textSecondary = s.fontColorSecondary || '#7a7f9a'
  const fontSizeBase  = s.fontSizeBase     || 13
  const fontSizeTitle = s.fontSizeTitle    || 15
  const fontSizeLabel = s.fontSizeLabel    || 11

  async function handleLaunch() {
    setLaunching(true)
    await onLaunch(game)
    setTimeout(() => setLaunching(false), 2000)
  }

  async function handleFetchByUrl() {
    const raw = ocUrl.trim()
    if (!raw) return
    const m = raw.match(/opencritic\.com\/game\/(\d+)|^(\d+)$/)
    if (!m) { setOcError('Paste a full OpenCritic URL or just the numeric game ID'); return }
    const id = m[1] || m[2]
    setOcFetching(true); setOcError(''); setOcSuccess('')
    try {
      const data = await window.peliVeli.fetchOcById(id)
      if (!data) { setOcError('No data returned — check the URL is correct'); return }
      setOcSuccess(`Matched: ${data.name || 'Unknown'}${!game.coverArt ? ' · Fetching cover art…' : ''}`)
      await onSetOc(game.id, { ocScore: data.ocScore, ocTier: data.ocTier, ocRecommend: data.ocRecommend,
        ocUrl: data.ocUrl, canonicalName: data.name })
      setOcUrl('')
      setTimeout(() => setOcSuccess(''), 4000)
    } catch (err) {
      setOcError('Network error — check your connection')
    } finally {
      setOcFetching(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setOcSuccess(''); setOcError('')
    await onRefresh(game.id)
    setRefreshing(false)
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 99,
      }} />

      <div style={{
        position: 'fixed', top: 136, right: 0, bottom: 0, width: 340,
        background: '#161820', borderLeft: '1px solid rgba(255,255,255,0.09)',
        borderTopLeftRadius: 14, zIndex: 100,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
        animation: 'slideInPanel 0.22s ease', fontFamily: font, color: textPrimary,
      }}>
      <style>{`
        @keyframes spinBtn { to { transform: rotate(360deg); } }
        @keyframes slideInPanel { from { transform: translateX(30px); opacity: 0 } to { transform: none; opacity: 1 } }
        .close-x-btn { transform: scale(1); transition: transform 0.15s ease !important; }
        .close-x-btn:hover { transform: scale(1.18) !important; }
      `}</style>

      {/* Close button — top-right, black circle, white ×, scales on hover */}
      <button onClick={onClose} title="Close" className="close-x-btn" style={{
        position: 'absolute', top: 12, right: 12, width: 30, height: 30,
        background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '50%', color: '#ffffff', fontSize: 17, cursor: 'pointer', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)', lineHeight: 1,
      }}>×</button>

      {/* Cover art */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '150%', background: '#1a1d28', flexShrink: 0 }}>
        {game.coverArt && !imgErr
          ? <img src={`peliveli://covers/${encodeURIComponent(game.coverArt.split(/[\\/]/).pop())}`}
              alt={game.displayTitle || game.title}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgErr(true)} />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 48, opacity: 0.12 }}>🎮</span>
            </div>
        }
        {/* Gradient fade at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(transparent, #161820)' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '12px 18px 24px', flex: 1 }}>

        {/* Title — leads the panel */}
        <h2 style={{ fontFamily:'Bebas Neue, cursive', fontSize:26, color:textPrimary,
          margin:'0 0 14px', letterSpacing:'0.04em', lineHeight:1.15 }}>
          {game.displayTitle || game.title}
        </h2>

        {/* Action tile buttons — equal width, icon + label */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {/* Refresh tile */}
          <button onClick={handleRefresh} disabled={refreshing} style={{
            flex: 1, padding: '9px 6px',
            background: '#1a1e2e', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 9, cursor: refreshing ? 'default' : 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            transition: 'all 0.15s', color: refreshing ? '#3a5a8e' : '#6a90b8' }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background = '#1a2540'; e.currentTarget.style.borderColor = 'rgba(74,128,192,0.4)'; e.currentTarget.style.color = '#90b8f0' }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#1a1e2e'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = refreshing ? '#3a5a8e' : '#6a90b8' }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>
              {refreshing
                ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #1e3060', borderTop:'2px solid #4a70ae', borderRadius:'50%', animation:'spinBtn 0.8s linear infinite' }} />
                : '↺'}
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'inherit', opacity: 0.7 }}>
              {refreshing ? 'Refreshing' : 'Refresh'}
            </span>
          </button>

          {/* Hide / Unhide tile */}
          <button onClick={() => isHidden ? onUnhide(game) : onHide(game)} style={{
            flex: 1, padding: '9px 6px',
            background: isHidden ? 'rgba(100,200,100,0.06)' : '#1a1e2e',
            border: `1px solid ${isHidden ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 9, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            transition: 'all 0.15s', color: isHidden ? '#6abf6a' : '#7a8090' }}
            onMouseEnter={e => {
              if (isHidden) { e.currentTarget.style.background = 'rgba(100,200,100,0.12)'; e.currentTarget.style.borderColor = 'rgba(100,200,100,0.45)'; e.currentTarget.style.color = '#8adf8a' }
              else          { e.currentTarget.style.background = '#251a1a'; e.currentTarget.style.borderColor = 'rgba(220,80,80,0.35)'; e.currentTarget.style.color = '#e08080' }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isHidden ? 'rgba(100,200,100,0.06)' : '#1a1e2e'
              e.currentTarget.style.borderColor = isHidden ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = isHidden ? '#6abf6a' : '#7a8090'
            }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>{isHidden ? '◎' : '⊘'}</span>
            <span style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'inherit', opacity: 0.7 }}>
              {isHidden ? 'Unhide' : 'Hide game'}
            </span>
          </button>
        </div>

        {/* OpenCritic */}
        <Section title="OpenCritic" textSecondary={textSecondary}>
          {game.ocTier ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:tierColor(game.ocTier),
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:`0 0 16px ${tierColor(game.ocTier)}66` }}>
                <span style={{ fontSize:fontSizeBase, fontWeight:800, color:'#fff' }}>{game.ocScore ?? '?'}</span>
              </div>
              <div>
                <div style={{ fontSize:fontSizeBase, fontWeight:700, color:tierColor(game.ocTier) }}>{game.ocTier}</div>
                {game.ocRecommend != null && (
                  <div style={{ fontSize:fontSizeLabel, color:textSecondary }}>{game.ocRecommend}% recommended</div>
                )}
                {game.ocUrl && (
                  <a href="#" onClick={e => { e.preventDefault(); window.peliVeli && require && true }}
                    style={{ fontSize:fontSizeLabel, color:'#4a80c0', textDecoration:'none' }}>
                    View on OpenCritic
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:fontSizeLabel, color:textSecondary, marginBottom:10 }}>No score found automatically.</div>
          )}

          {/* Manual OC URL input */}
          <div style={{ marginTop: game.ocTier ? 8 : 0 }}>
            {game.ocTier && (
              <div style={{ fontSize:fontSizeLabel, color:textSecondary, marginBottom:6, opacity:0.7 }}>Change OpenCritic link:</div>
            )}
            <div style={{ display:'flex', gap:6 }}>
              <input value={ocUrl} onChange={e=>setOcUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchByUrl()}
                placeholder="opencritic.com/game/12345/..."
                style={{ flex:1, background:'#1e2130', border:'1px solid rgba(255,255,255,0.09)',
                  borderRadius:7, padding:'6px 10px', color:textPrimary, fontSize:fontSizeLabel,
                  fontFamily:font, outline:'none' }} />
              <button onClick={handleFetchByUrl} disabled={ocFetching} style={{
                padding:'6px 10px', background:'#1e3060', border:'1px solid #2a4080',
                borderRadius:7, color:ocFetching ? '#3a5a8e' : '#90b8f0', fontSize:fontSizeLabel,
                cursor:ocFetching ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                {ocFetching ? '…' : '↓ Fetch'}
              </button>
            </div>
            {ocError   && <div style={{ fontSize:fontSizeLabel, color:'#e05050', marginTop:5 }}>{ocError}</div>}
            {ocSuccess && <div style={{ fontSize:fontSizeLabel, color:'#50c878', marginTop:5 }}>{ocSuccess}</div>}
          </div>
        </Section>

        {/* Metadata */}
        <Section title="Details" textSecondary={textSecondary}>
          <MetaRow label="Platform" value={game.platform} textSecondary={textSecondary} textPrimary={textPrimary} fontSize={fontSizeLabel} />
          {game.installDir && <MetaRow label="Install Path" value={game.installDir} textSecondary={textSecondary} textPrimary={textPrimary} fontSize={fontSizeLabel} mono />}
          {game.sizeBytes > 0 && <MetaRow label="Size" value={formatSize(game.sizeBytes)} textSecondary={textSecondary} textPrimary={textPrimary} fontSize={fontSizeLabel} />}
          {game.appId && <MetaRow label="App ID" value={game.appId} textSecondary={textSecondary} textPrimary={textPrimary} fontSize={fontSizeLabel} mono />}
        </Section>

        {/* Launch */}
        <button onClick={handleLaunch} disabled={launching} style={{
          width:'100%', padding:'13px',
          background: launching ? '#141620' : 'linear-gradient(135deg,#1e3a6e,#2e5fae)',
          border: `1px solid ${launching ? '#1e2030' : '#2e5fae55'}`,
          borderRadius:10, cursor: launching ? 'default' : 'pointer',
          color: launching ? '#2a3050' : '#a0c0f0',
          fontFamily:"'Bebas Neue', cursive", fontSize:18, letterSpacing:'0.12em',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          transition:'all 0.2s', marginTop:4 }}>
          {launching ? <><BtnSpinner />LAUNCHING…</> : '▶  LAUNCH GAME'}
        </button>
      </div>
    </div>
    </>
  )
}

function Section({ title, children, textSecondary }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:9, color:textSecondary, letterSpacing:'0.18em', textTransform:'uppercase',
        marginBottom:10, opacity:0.7 }}>{title}</div>
      {children}
    </div>
  )
}

function MetaRow({ label, value, textSecondary, textPrimary, fontSize, mono }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:7, alignItems:'flex-start' }}>
      <span style={{ fontSize, color:textSecondary, flexShrink:0, width:80 }}>{label}</span>
      <span style={{ fontSize, color:textPrimary, wordBreak:'break-all',
        fontFamily: mono ? 'Consolas, monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

function BtnSpinner() {
  return <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #1e2a40',
    borderTop:'2px solid #4a70ae', borderRadius:'50%', animation:'spinBtn 0.8s linear infinite' }} />
}

function formatSize(bytes) {
  if (!bytes) return null
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function tierColor(tier) {
  if (tier === 'Mighty') return '#00c896'
  if (tier === 'Strong') return '#4a90e2'
  if (tier === 'Fair')   return '#f0a020'
  return '#e05050'
}
