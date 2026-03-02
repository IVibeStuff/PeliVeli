import { useState, useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const CARD_WIDTHS = { small: 118, medium: 152, large: 198 }

function formatSize(b) {
  if (!b || b === 0) return null
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${b} bytes`
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}

function platformCardBg(platform, settings, active) {
  const pc = settings?.platformColors?.[platform]
  if (!pc) return active ? '#252838' : '#1e2130'
  const { r, g, b } = hexToRgb(pc.primary)
  const i = (pc.intensity || 0.12) * (active ? 1.7 : 1)
  return `rgba(${r},${g},${b},${i})`
}

const OC_TIERS = {
  Mighty: { color: '#f5c518', icon: '👑' },
  Strong: { color: '#4caf50', icon: '💚' },
  Fair:   { color: '#ff9800', icon: '🟡' },
  Weak:   { color: '#f44336', icon: '🔴' },
}

export default function GameGrid({ games, hiddenIds, onSelect, selectedId }) {
  const s = useContext(SettingsContext)
  const cardWidth = CARD_WIDTHS[s?.cardSize || 'medium']

  if (games.length === 0) return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: s?.fontColorSecondary || '#7a7f9a', fontSize: s?.fontSizeBase || 13,
      fontFamily: s?.fontFamily || 'Segoe UI',
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      No games found — try scanning your library
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 24px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
        gap: 14,
      }}>
        {games.map(g => (
          <GameCard key={g.id} game={g} isHidden={hiddenIds?.has(g.id)} onClick={() => onSelect(g)} selected={g.id === selectedId} settings={s} />
        ))}
      </div>
    </div>
  )
}

function GameCard({ game, isHidden, onClick, selected, settings }) {
  const [hovered, setHovered] = useState(false)
  const [imgErr, setImgErr]   = useState(false)
  const pc    = settings?.platformColors?.[game.platform] || {}
  const color = pc.primary || '#6b7290'
  const tier  = game.ocTier ? OC_TIERS[game.ocTier] : null
  const active = hovered || selected

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={game.title}
      style={{
        background: platformCardBg(game.platform, settings, active),
        border: `1px solid ${active ? color + '44' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.18s ease',
        boxShadow: hovered ? `0 10px 28px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.2)',
        opacity: isHidden ? 0.45 : 1,
      }}
    >
      {/* Cover art */}
      <div style={{ position: 'relative', aspectRatio: '3/4', width: '100%' }}>
        {game.coverArt && !imgErr
          ? <img src={game.coverArt} alt={game.title} onError={() => setImgErr(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <FallbackCover game={game} />
        }

        {/* Dark scrim at top so badges are always readable */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 44,
          background: 'linear-gradient(rgba(0,0,0,0.55), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Platform badge — only show on cover when size row is NOT shown */}
        {!settings?.showSizeOnCards && (
          <div style={{ position: 'absolute', top: 7, left: 7 }}>
            <PlatformBadge platform={game.platform} color={color} />
          </div>
        )}

        {/* OC tier badge — solid dark pill, always visible */}
        {tier && (
          <div
            title={`OpenCritic: ${game.ocTier}${game.ocScore ? ` (${game.ocScore})` : ''}`}
            style={{ position: 'absolute', top: 7, right: 7 }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.72)',
              border: `1px solid ${tier.color}70`,
              borderRadius: 6, padding: '2px 6px',
              fontSize: 11, lineHeight: 1.4,
              backdropFilter: 'blur(4px)',
            }}>
              {tier.icon}
            </div>
          </div>
        )}
      </div>

      {/* Title + optional size badge row */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{
          fontWeight: 600,
          fontSize: settings?.fontSizeTitle || 13,
          fontFamily: settings?.fontFamily || 'Segoe UI',
          color: settings?.fontColorPrimary || '#d4d6e0',
          lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: settings?.showSizeOnCards ? 6 : 0,
        }}>
          {game.displayTitle || game.title}
        </div>
        {settings?.showSizeOnCards && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            {/* Platform pill */}
            <div style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}50`, borderRadius: 5, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: settings?.fontColorPrimary || '#d4d6e0', fontWeight: 700, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{game.platform}</span>
            </div>
            {/* Size pill */}
            {formatSize(game.sizeBytes) && (
              <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, padding: '2px 7px' }}>
                <span style={{ color: settings?.fontColorSecondary || '#7a7f9a', fontWeight: 600, fontSize: 9, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {formatSize(game.sizeBytes)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Solid opaque badge — always readable regardless of cover art colour
function PlatformBadge({ platform, color }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.75)',
      border: `1px solid ${color}80`,
      borderRadius: 5,
      padding: '2px 7px',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      backdropFilter: 'blur(4px)',
    }}>
      {/* Coloured dot */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {platform}
      </span>
    </div>
  )
}

function FallbackCover({ game }) {
  const initials = game.title.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
  const gradients = [
    'linear-gradient(135deg,#1e2340,#2a3560)',
    'linear-gradient(135deg,#1a1530,#2d1a50)',
    'linear-gradient(135deg,#152030,#1e3850)',
    'linear-gradient(135deg,#2a1400,#4a2800)',
    'linear-gradient(135deg,#0e2218,#1a4030)',
    'linear-gradient(135deg,#22102a,#3a1a48)',
  ]
  return (
    <div style={{
      width: '100%', height: '100%',
      background: gradients[game.title.charCodeAt(0) % gradients.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 22, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em' }}>
        {initials}
      </span>
    </div>
  )
}
