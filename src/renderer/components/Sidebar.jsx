import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const PLATFORM_DEFAULTS = {
  Steam:   '#1a9fff', Epic: '#a0a0a0', GOG: '#a855f7', Ubisoft: '#0070ff', EA: '#ff6b35', Other: '#8888aa',
}
const PLATFORM_ICONS = { Steam: '🎮', Epic: '🛡', GOG: '🌌', Ubisoft: '🔷', EA: '🟠', Other: '📦', All: '◈' }

function isLight(hex) {
  try {
    const c = (hex || '').replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
    return (r*299 + g*587 + b*114) / 1000 > 160
  } catch(_) { return false }
}

export default function Sidebar({ selectedPlatform, onSelectPlatform, platformCounts, totalCount }) {
  const s     = useContext(SettingsContext)
  const font  = s.fontFamily         || 'Segoe UI'
  const base  = s.fontSizeBase       || 13
  const lbl   = s.fontSizeLabel      || 11

  // Derive text colours from the sidebar background so they're always readable
  // regardless of what fontColorPrimary is set to (e.g. dark ink on NASA-PUNK parchment)
  const sidebarBg = s.sidebarBackground || '#0c0e16'
  const lightSidebar = isLight(sidebarBg)
  const pri = lightSidebar ? '#1a1a14' : (s.fontColorPrimary   || '#ffffff')
  const sec = lightSidebar ? '#5a5a4a' : (s.fontColorSecondary || '#a0a8b8')

  const platforms = Object.keys(platformCounts).sort()

  function PlatformRow({ name, count, isAll }) {
    const active = selectedPlatform === name
    const pc     = (s.platformColors || {})[name]
    const color  = isAll ? '#4a80c0' : (pc?.primary || PLATFORM_DEFAULTS[name] || '#888')
    return (
      <div onClick={() => onSelectPlatform(name)} style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px',
        cursor: 'pointer', borderRadius: 7, margin: '1px 6px', transition: 'all 0.15s',
        background: active ? `${color}22` : 'transparent',
        borderLeft: `2px solid ${active ? color : 'transparent'}`,
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = lightSidebar ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontSize: 13, opacity: 0.8 }}>{PLATFORM_ICONS[name] || '🎮'}</span>
        <span style={{ flex: 1, fontSize: lbl, fontWeight: active ? 700 : 500, color: active ? pri : sec, fontFamily: font,
          letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ fontSize: 10, color: active ? color : sec, opacity: active ? 1 : 0.6,
          background: active ? `${color}22` : 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 10, fontFamily: font }}>{count}</span>
      </div>
    )
  }

  const bg     = s.sidebarBackground  || '#0c0e16'
  const border  = s.borderColor         || 'rgba(255,255,255,0.06)'

  return (
    <div style={{ width: 168, background: bg, borderRight: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, paddingTop: 14, overflowY: 'auto' }}>
      <div style={{ padding: '0 14px 10px', fontSize: 9, color: sec, letterSpacing: '0.18em',
        textTransform: 'uppercase', opacity: 0.6, fontFamily: font }}>Library</div>

      <PlatformRow name="All" count={totalCount} isAll />

      <div style={{ margin: '8px 14px 6px', height: 1, background: lightSidebar ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)' }} />
      <div style={{ padding: '0 14px 6px', fontSize: 9, color: sec, letterSpacing: '0.18em',
        textTransform: 'uppercase', opacity: 0.5, fontFamily: font }}>Platforms</div>

      {platforms.map(p => <PlatformRow key={p} name={p} count={platformCounts[p]} />)}
    </div>
  )
}
