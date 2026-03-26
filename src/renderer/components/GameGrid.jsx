import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const CARD_WIDTHS  = { small: 118, medium: 152, large: 198 }
const CARD_HEIGHTS = { small: 177, medium: 228, large: 297 }

const PLATFORM_DEFAULTS = {
  Steam:   { primary: '#1a9fff', intensity: 0.12 },
  Epic:    { primary: '#a0a0a0', intensity: 0.10 },
  GOG:     { primary: '#a855f7', intensity: 0.10 },
  Ubisoft: { primary: '#0070ff', intensity: 0.10 },
  EA:      { primary: '#ff6b35', intensity: 0.10 },
}


function formatSize(bytes) {
  if (!bytes || bytes === 0) return null
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

// ── Option C: pill badge — lives INSIDE cover div (overflow:hidden is fine) ──

// ── Option F: review badge — lives on the CARD wrapper, NOT inside the cover ──
// Positioned absolutely on the card so it's never clipped by cover's overflow:hidden.
// `coverHeight` tells it exactly where the cover/title boundary is.

function isLight(hex) {
  try {
    const c = (hex || '').replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
    return (r*299 + g*587 + b*114) / 1000 > 160
  } catch(_) { return false }
}

export default function GameGrid({ games, selectedGame, onSelectGame, hiddenIds }) {
  const s    = useContext(SettingsContext)
  const size = s.cardSize            || 'medium'
  const W    = CARD_WIDTHS[size]
  const H    = CARD_HEIGHTS[size]
  const font = s.fontFamily          || 'Segoe UI'
  const pri  = s.fontColorPrimary    || '#d4d6e0'
  // Card title sits on the appBg gradient — derive colour from background brightness
  const cardTitleColor = isLight(s.appBackground || '#0c0e16') ? '#1a1a14' : '#ffffff'
  const sec  = s.fontColorSecondary  || '#7a7f9a'
  const appBg          = s.appBackground    || '#0c0e16'
  const titleSize      = s.fontSizeTitle    || 15
    
  if (games.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: sec, fontSize: s.fontSizeBase || 13, fontFamily: font, background: appBg }}>
      No games to show
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 16px', background: appBg }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        {games.map(game => {
          const pc         = (s.platformColors || {})[game.platform] || PLATFORM_DEFAULTS[game.platform] || { primary: '#888', intensity: 0.10 }
          const col        = pc.primary
          const intensity  = pc.intensity
          const isSelected  = selectedGame?.id === game.id
          const isHidden    = hiddenIds?.has(game.id)
          const sizeLabel   = s.showSizeOnCards ? formatSize(game.sizeBytes) : null
          const displayTitle = game.displayTitle || game.title
          // Extra top padding on title area so review badge doesn't overlap game name
          
          return (
            <div key={game.id} onClick={() => onSelectGame(game)} style={{
              width: W, flexShrink: 0, cursor: 'pointer', borderRadius: 10,
              // overflow VISIBLE on the card wrapper so review badge is never clipped
              overflow: 'visible',
              border: `1px solid ${isSelected ? col + '88' : 'rgba(255,255,255,0.07)'}`,
              // Use appBg as the gradient end so light themes (NASA-punk) look correct
              background: `linear-gradient(160deg, ${col}${Math.round(intensity * 255).toString(16).padStart(2,'0')}, ${appBg})`,
              boxShadow: isSelected ? `0 0 0 2px ${col}55, 0 8px 24px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.35)',
              transition: 'all 0.18s', opacity: isHidden ? 0.4 : 1,
              transform: isSelected ? 'translateY(-2px)' : 'none',
              position: 'relative',
            }}
              onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px rgba(0,0,0,0.5)` }}}
              onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)' }}}
            >
              {/* Cover art — overflow:hidden scoped here only, keeps pill badge inside */}
              <div style={{
                position: 'relative', width: W, height: H,
                background: appBg, overflow: 'hidden', borderRadius: '9px 9px 0 0',
              }}>
                {game.coverArt
                  ? <img
                      src={`peliveli://covers/${encodeURIComponent(game.coverArt.split(/[\\/]/).pop())}`}
                      alt={displayTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 28, opacity: 0.15 }}>🎮</span>
                    </div>
                }
                {/* Platform badge */}
                <div style={{
                  position: 'absolute', bottom: 6, left: 6, padding: '2px 7px', borderRadius: 5,
                  background: col + 'cc', fontSize: 9, fontWeight: 700, color: '#fff',
                  letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: font,
                }}>{game.platform}</div>

                {/* Size badge */}
                {sizeLabel && (
                  <div style={{
                    position: 'absolute', bottom: 6, right: 6, padding: '2px 6px', borderRadius: 5,
                    background: 'rgba(0,0,0,0.7)', fontSize: 9, color: sec, fontFamily: font,
                  }}>{sizeLabel}</div>
                )}
              </div>

              {/* Title */}
              <div style={{ padding: '7px 8px 8px', fontFamily: font }}>
                <div style={{
                  fontSize: titleSize, color: cardTitleColor, fontWeight: 600, lineHeight: 1.25,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {displayTitle}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
