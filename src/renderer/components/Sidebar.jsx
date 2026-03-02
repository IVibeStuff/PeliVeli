import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const PLATFORM_ORDER = ['Steam','Epic','GOG','Ubisoft','EA']

export default function Sidebar({
  selectedPlatform, onSelectPlatform,
  platformCounts, totalCount,
  hiddenCount,
  launchersNotFound,
  onOpenSettings, onScan, scanning,
}) {
  const s  = useContext(SettingsContext)
  const pc = s?.platformColors || {}
  const textPrimary   = s?.fontColorPrimary   || '#d4d6e0'
  const textSecondary = s?.fontColorSecondary || '#7a7f9a'
  const font          = s?.fontFamily         || 'Segoe UI'
  const fontSize      = s?.fontSizeBase       || 13

  return (
    <div style={{
      width: 214, flexShrink: 0,
      background: '#161820',
      borderRight: '1px solid rgba(255,255,255,0.09)',
      display: 'flex', flexDirection: 'column',
      paddingBottom: 14,
    }}>
      {/* Titlebar drag region */}
      <div className="titlebar-drag" style={{
        height: 36, display: 'flex', alignItems: 'center',
        padding: '0 18px',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
        flexShrink: 0,
      }}>
        <span className="titlebar-no-drag" style={{
          fontFamily: 'Bebas Neue, cursive',
          fontSize: 19, letterSpacing: '0.12em',
          color: textPrimary,
        }}>PeliVeli</span>
      </div>

      {/* Scan button */}
      <div style={{ padding: '12px 12px 6px' }}>
        <button
          onClick={onScan}
          disabled={scanning}
          style={{
            width: '100%', padding: '10px 14px',
            background: scanning ? '#1e2130' : 'linear-gradient(135deg,#1e3a6e,#2e5fae)',
            border: `1px solid ${scanning ? '#252840' : '#3a70c055'}`,
            borderRadius: 10,
            color: scanning ? '#3a4060' : '#c0d8f8',
            fontFamily: 'Bebas Neue, cursive',
            fontSize: 14, letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!scanning) e.currentTarget.style.filter = 'brightness(1.12)' }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
        >
          {scanning ? <><Spinner /> SCANNING...</> : '⟳ SCAN LIBRARY'}
        </button>
      </div>

      {/* Library filter list */}
      <div style={{ padding: '6px 10px 0', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 9, color: textSecondary, opacity: 0.4, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 8px 8px', fontFamily: font }}>
          Library
        </div>

        <SidebarItem label="All Games" count={totalCount} color={textSecondary}
          active={selectedPlatform === 'All'} onClick={() => onSelectPlatform('All')}
          textPrimary={textPrimary} textSecondary={textSecondary} font={font} fontSize={fontSize} />

        {PLATFORM_ORDER.map(p => (
          <SidebarItem key={p}
            label={p}
            count={platformCounts[p] || 0}
            color={pc[p]?.primary || '#6b7290'}
            active={selectedPlatform === p}
            onClick={() => onSelectPlatform(p)}
            textPrimary={textPrimary} textSecondary={textSecondary} font={font} fontSize={fontSize}
          />
        ))}

        {launchersNotFound.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9, color: textSecondary, opacity: 0.35, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 8px 6px', fontFamily: font }}>
              Not Detected
            </div>
            <div style={{ margin: '0 4px', padding: '8px 10px', background: 'rgba(255,200,0,0.05)', border: '1px solid rgba(255,200,0,0.1)', borderRadius: 8 }}>
              {launchersNotFound.map(n => (
                <div key={n} style={{ fontSize: Math.max(fontSize - 2, 10), color: textSecondary, opacity: 0.4, fontFamily: font, paddingBottom: 3 }}>
                  {n} not found
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden game count hint */}
      {hiddenCount > 0 && (
        <div style={{ padding: '4px 14px 0' }}>
          <div style={{ fontSize: 10, color: textSecondary, opacity: 0.45, fontFamily: font, letterSpacing: '0.06em' }}>
            {hiddenCount} game{hiddenCount !== 1 ? 's' : ''} hidden · Settings to show
          </div>
        </div>
      )}

      {/* Settings button — properly visible */}
      <div style={{ padding: '10px 12px 0' }}>
        <button
          onClick={onOpenSettings}
          style={{
            width: '100%', padding: '9px 12px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 9,
            color: textPrimary,
            fontSize: Math.max(fontSize - 1, 12),
            fontFamily: font,
            textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.24)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
        >
          ⚙ Settings
        </button>
      </div>
    </div>
  )
}

function SidebarItem({ label, count, color, active, onClick, textPrimary, textSecondary, font, fontSize }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '8px 10px', borderRadius: 9, marginBottom: 2,
        background: active ? `${color}20` : 'transparent',
        border: active ? `1px solid ${color}35` : '1px solid transparent',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: font,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: fontSize || 13, fontWeight: active ? 700 : 400, color: active ? color : textPrimary }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: active ? color : textSecondary, fontWeight: 700, opacity: active ? 1 : 0.6 }}>
        {count}
      </span>
    </button>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11,
      border: '2px solid #252840', borderTop: '2px solid #4a6a9e',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  )
}
