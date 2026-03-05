import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

// Returns true if a hex colour is perceptually light
function isLight(hex) {
  try {
    const c = (hex || '').replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
    return (r*299 + g*587 + b*114) / 1000 > 160
  } catch(_) { return false }
}

export default function TopBar({ search, onSearch, sortBy, onSort, onScan, onAddGame, scanning, gameCount, totalCount, onOpenSettings }) {
  const s    = useContext(SettingsContext)
  const font  = s.fontFamily  || 'Calibri, Segoe UI, sans-serif'
  const lbl   = s.fontSizeLabel || 11
  const base  = s.fontSizeBase  || 13
  const topBg = s.topbarBackground || '#0f1118'
  const lightTopbar = isLight(topBg)

  // Always derive text colours from topbar brightness — never from fontColorPrimary
  // (fontColorPrimary may be dark ink for a light-background theme like NASA-PUNK)
  const pri = lightTopbar ? '#1a1a14' : (s.fontColorPrimary   || '#ffffff')
  const sec = lightTopbar ? '#5a5a4a' : (s.fontColorSecondary || '#a0a8b8')

  const cogColor        = lightTopbar ? '#1a1a14' : sec
  const cogBorder       = lightTopbar ? 'rgba(26,26,20,0.3)' : 'rgba(255,255,255,0.07)'
  const cogBorderHover  = lightTopbar ? 'rgba(26,26,20,0.6)' : 'rgba(255,255,255,0.18)'
  const cogColorHover   = lightTopbar ? '#000000'            : pri
  const inputBg         = lightTopbar ? 'rgba(26,26,20,0.08)' : '#171922'
  const inputBorder     = lightTopbar ? 'rgba(26,26,20,0.2)'  : 'rgba(255,255,255,0.08)'
  const sortActiveBg    = lightTopbar ? 'rgba(26,26,20,0.15)' : 'rgba(255,255,255,0.1)'
  const sortActiveBdr   = lightTopbar ? 'rgba(26,26,20,0.3)'  : 'rgba(255,255,255,0.15)'
  const sortInactiveBdr = lightTopbar ? 'rgba(26,26,20,0.15)' : 'rgba(255,255,255,0.07)'
  const countBg         = lightTopbar ? 'rgba(26,26,20,0.06)' : 'rgba(255,255,255,0.03)'
  const countBorder     = lightTopbar ? 'rgba(26,26,20,0.12)' : 'rgba(255,255,255,0.05)'

  return (
    <div className="titlebar-drag" style={{
      padding: '0 18px', borderBottom: `1px solid ${s.borderColor || 'rgba(255,255,255,0.06)'}`,
      background: topBg, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10, height: 56,
      fontFamily: font,
    }}>

      {/* Search */}
      <div className="titlebar-no-drag" style={{ flex: 1, maxWidth: 280 }}>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search games..."
          style={{ width: '100%', background: inputBg, border: `1px solid ${inputBorder}`,
            borderRadius: 8, padding: '7px 12px', color: pri, fontSize: lbl,
            letterSpacing: '0.03em', fontFamily: font, outline: 'none' }} />
      </div>

      {/* Sort buttons */}
      <div className="titlebar-no-drag" style={{ display: 'flex', gap: 5 }}>
        {[['alpha','A–Z'],['platform','Platform'],['size','Size'],['score','Score']].map(([val, label]) => (
          <button key={val} onClick={() => onSort(val)} style={{
            padding: '6px 11px',
            background: sortBy.key === val ? sortActiveBg : 'transparent',
            border: `1px solid ${sortBy.key === val ? sortActiveBdr : sortInactiveBdr}`,
            borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
            color: sortBy.key === val ? pri : sec, fontSize: lbl, fontWeight: 600,
            letterSpacing: '0.04em', fontFamily: font,
          }}>
            {label}{sortBy.key === val ? (sortBy.dir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      {/* Game count */}
      <span className="titlebar-no-drag" style={{
        fontSize: lbl, color: sec, opacity: 0.7,
        padding: '5px 10px', background: countBg,
        border: `1px solid ${countBorder}`, borderRadius: 6,
        whiteSpace: 'nowrap',
      }}>
        {gameCount === totalCount ? `${totalCount} games` : `${gameCount} / ${totalCount}`}
      </span>

      <div style={{ flex: 1 }} />

      {/* Settings cog — black on light topbar, themed on dark */}
      <div className="titlebar-no-drag">
        <button onClick={onOpenSettings} style={{
          padding: '7px 11px', background: 'transparent',
          border: `1px solid ${cogBorder}`, borderRadius: 7,
          color: cogColor, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = cogBorderHover; e.currentTarget.style.color = cogColorHover }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = cogBorder; e.currentTarget.style.color = cogColor }}
        >⚙</button>
      </div>

      {/* Add Game + Scan buttons */}
      <div className="titlebar-no-drag" style={{ marginRight: 140, display: 'flex', gap: 7 }}>
        <button onClick={onAddGame} disabled={scanning} style={{
          padding: '7px 14px',
          background: 'transparent',
          border: `1px solid ${scanning ? sortInactiveBdr : sortActiveBdr}`,
          borderRadius: 8, cursor: scanning ? 'default' : 'pointer',
          color: scanning ? sec : sec,
          fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: '0.1em',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { if (!scanning) { e.currentTarget.style.background = sortActiveBg; e.currentTarget.style.color = pri } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sec }}
        >
          + ADD GAME
        </button>
        <button onClick={onScan} disabled={scanning} style={{
          padding: '7px 18px',
          background: scanning ? '#141620' : 'linear-gradient(135deg,#1e3a6e,#2e5fae)',
          border: `1px solid ${scanning ? '#1e2030' : '#2e5fae'}`,
          borderRadius: 8, cursor: scanning ? 'default' : 'pointer',
          color: scanning ? '#2a3050' : '#90b8f0',
          fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.2s',
        }}>
          {scanning ? <><Spinner />SCANNING...</> : '⟳ SCAN LIBRARY'}
        </button>
      </div>

    </div>
  )
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 12, height: 12,
    border: '2px solid #1e2a40', borderTop: '2px solid #3a5a8e',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
}
