import { useState, useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const OC_TIERS = {
  Mighty: { color: '#f5c518', icon: '👑', label: 'Mighty' },
  Strong: { color: '#4caf50', icon: '💚', label: 'Strong' },
  Fair:   { color: '#ff9800', icon: '🟡', label: 'Fair'   },
  Weak:   { color: '#f44336', icon: '🔴', label: 'Weak'   },
}

function formatSize(b) {
  if (!b || b === 0) return null
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${b} bytes`
}

export default function DetailPanel({ game, isHidden, onClose, onLaunch, onHide, onUnhide, onSetOc, onRefresh }) {
  const [launching, setLaunching]     = useState(false)
  const [imgErr, setImgErr]           = useState(false)
  const [ocUrl, setOcUrl]             = useState('')
  const [ocFetching, setOcFetching]   = useState(false)
  const [ocError, setOcError]         = useState('')
  const [ocSuccess, setOcSuccess]     = useState('')
  const [refreshing, setRefreshing]   = useState(false)
  const s = useContext(SettingsContext)

  const pc            = s?.platformColors?.[game.platform] || {}
  const platformColor = pc.primary || '#6b7290'
  const tier          = game.ocTier ? OC_TIERS[game.ocTier] : null
  const textPrimary   = s?.fontColorPrimary   || '#d4d6e0'
  const textSecondary = s?.fontColorSecondary || '#7a7f9a'
  const font          = s?.fontFamily         || 'Segoe UI'
  const fontSizeBase  = s?.fontSizeBase       || 13
  const fontSizeLabel = s?.fontSizeLabel      || 11

  async function handleLaunch() {
    setLaunching(true)
    await onLaunch(game)
    setTimeout(() => setLaunching(false), 2500)
  }

  async function handleFetchByUrl() {
    setOcError('')
    // Extract numeric game ID from URLs like:
    //   https://opencritic.com/game/7798/baldurs-gate-3
    //   https://opencritic.com/game/7798
    //   7798  (bare ID)
    const match = ocUrl.trim().match(/opencritic\.com\/game\/(\d+)|^(\d+)$/)
    if (!match) {
      setOcError('Paste a full OpenCritic URL, e.g. https://opencritic.com/game/7798/...')
      return
    }
    const gameId = match[1] || match[2]
    setOcFetching(true)
    try {
      const data = await window.peliVeli.fetchOcById(gameId)
      if (!data) {
        setOcError('No data returned — check the URL and try again.')
      } else {
        setOcSuccess(`Matched: ${data.name}${!game.coverArt ? ' · Fetching cover art…' : ''}`)
        await onSetOc(game.id, {
          ocScore:       data.ocScore,
          ocTier:        data.ocTier,
          ocRecommend:   data.ocRecommend,
          ocUrl:         data.ocUrl,
          canonicalName: data.name,
        })
        setOcUrl('')
      }
    } catch (err) {
      setOcError('Error fetching score. Check your internet connection.')
    } finally {
      setOcFetching(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setOcSuccess('')
    setOcError('')
    await onRefresh(game.id)
    setRefreshing(false)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 136,
      right: 0,
      bottom: 0,
      width: 340,
      background: '#161820',
      borderLeft: '1px solid rgba(255,255,255,0.09)',
      borderTopLeftRadius: 14,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
      animation: 'slideInPanel 0.22s ease',
      fontFamily: font,
      color: textPrimary,
    }}>
      <style>{`@keyframes spinBtn { to { transform: rotate(360deg); } }`}</style>

      {/* Close button — solid black circle, always visible over any artwork */}
      <button
        onClick={onClose}
        title="Close"
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 30, height: 30,
          background: '#000000',
          border: '2px solid rgba(255,255,255,0.4)',
          borderRadius: '50%',
          color: '#ffffff',
          fontSize: 15, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 20,
          boxShadow: '0 2px 10px rgba(0,0,0,0.9)',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.75)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
      >✕</button>

      {/* Cover art — aspect-ratio based, fills width, never clips */}
      <div style={{ width: '100%', position: 'relative', flexShrink: 0 }}>
        {game.coverArt && !imgErr ? (
          <img
            src={game.coverArt}
            alt={game.title}
            onError={() => setImgErr(true)}
            style={{
              width: '100%',
              // Portrait covers are 2:3, use that ratio so image shows fully
              aspectRatio: '2/3',
              objectFit: 'cover',
              objectPosition: 'top',
              display: 'block',
              borderRadius: '14px 0 0 0',
            }}
          />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '2/3',
            borderRadius: '14px 0 0 0',
            overflow: 'hidden',
          }}>
            <FallbackCover game={game} />
          </div>
        )}
        {/* Fade bottom of image into panel background */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(transparent, #161820)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 28px', flex: 1 }}>

        {/* Platform badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#000000',
            border: `1px solid ${platformColor}80`,
            borderRadius: 6, padding: '3px 10px',
            fontSize: fontSizeLabel,
            color: '#ffffff',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: platformColor, display: 'inline-block' }} />
            {game.platform}
          </span>
        </div>

        {/* Action buttons row — hide/unhide + refresh */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: 'transparent',
              border: '1px solid rgba(74,128,192,0.3)',
              borderRadius: 6, padding: '3px 10px',
              color: refreshing ? '#3a5a8e' : '#5a90c0',
              fontSize: fontSizeLabel, cursor: refreshing ? 'default' : 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.borderColor = 'rgba(74,128,192,0.6)'; e.currentTarget.style.color = '#90b8f0' }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,128,192,0.3)'; e.currentTarget.style.color = refreshing ? '#3a5a8e' : '#5a90c0' }}
          >
            {refreshing
              ? <><span style={{ display:'inline-block', width:9, height:9, border:'2px solid #1e3060', borderTop:'2px solid #4a70ae', borderRadius:'50%', animation:'spinBtn 0.8s linear infinite' }} /> Refreshing…</>
              : '↺ Refresh art & score'
            }
          </button>

          <button
            onClick={() => isHidden ? onUnhide(game) : onHide(game)}
            style={{
              background: 'transparent',
              border: `1px solid ${isHidden ? 'rgba(100,200,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6, padding: '3px 10px',
              color: isHidden ? '#6abf6a' : textSecondary,
              fontSize: fontSizeLabel, cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = isHidden ? 'rgba(100,200,100,0.6)' : 'rgba(255,80,80,0.4)'
              e.currentTarget.style.color       = isHidden ? '#8adf8a'               : '#ff8080'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = isHidden ? 'rgba(100,200,100,0.3)' : 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color       = isHidden ? '#6abf6a'               : textSecondary
            }}
          >
            {isHidden ? '👁 Unhide' : '🚫 Hide'}
          </button>
        </div>

        <h2 style={{
          fontFamily: 'Bebas Neue, cursive',
          fontSize: 26, color: textPrimary,
          margin: '0 0 16px', letterSpacing: '0.04em', lineHeight: 1.15,
        }}>
          {game.displayTitle || game.title}
        </h2>

        {/* OpenCritic */}
        <Section title="OpenCritic" textSecondary={textSecondary}>
          {tier ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                {game.ocScore != null && (
                  <div style={{
                    width: 54, height: 54, borderRadius: '50%',
                    background: `conic-gradient(${tier.color} ${game.ocScore * 3.6}deg, #252838 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e2130', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 19, color: tier.color }}>{game.ocScore}</span>
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${tier.color}22`, border: `1px solid ${tier.color}50`, borderRadius: 7, padding: '4px 10px', marginBottom: 5 }}>
                    <span style={{ fontSize: 13 }}>{tier.icon}</span>
                    <span style={{ color: tier.color, fontWeight: 700, fontSize: fontSizeBase }}>{tier.label}</span>
                  </div>
                  {game.ocRecommend != null && (
                    <div style={{ fontSize: fontSizeLabel, color: textSecondary }}>{game.ocRecommend}% of critics recommend</div>
                  )}
                </div>
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: textSecondary, opacity: 0.4 }}>
                Powered by OpenCritic · <span
                  style={{ cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}
                  onClick={() => setOcUrl(game.ocUrl || '')}
                >Change</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: fontSizeLabel, color: textSecondary, fontStyle: 'italic', marginBottom: 10 }}>
              No score found automatically.
            </div>
          )}

          {/* Manual OC URL input — always shown when no score, or when "Change" clicked */}
          {(!tier || ocUrl !== '') && (
            <div style={{ marginTop: tier ? 10 : 0 }}>
              <div style={{ fontSize: fontSizeLabel, color: textSecondary, marginBottom: 6 }}>
                {tier ? 'Override with a different OpenCritic page:' : 'Paste the OpenCritic URL to fetch the score:'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={ocUrl}
                  onChange={e => { setOcUrl(e.target.value); setOcError(''); setOcSuccess('') }}
                  onKeyDown={e => e.key === 'Enter' && !ocFetching && handleFetchByUrl()}
                  placeholder="https://opencritic.com/game/7798/..."
                  style={{
                    flex: 1, background: '#252838',
                    border: `1px solid ${ocError ? 'rgba(220,80,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 7, padding: '7px 10px',
                    color: textPrimary, fontSize: 12,
                    fontFamily: 'monospace', minWidth: 0,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleFetchByUrl}
                  disabled={!ocUrl.trim() || ocFetching}
                  style={{
                    padding: '7px 12px', borderRadius: 7, border: 'none',
                    background: ocFetching ? '#252838' : 'linear-gradient(135deg,#1e3a6e,#2e5fae)',
                    color: ocFetching ? '#4a5068' : '#c0d8f8',
                    fontSize: 12, cursor: ocFetching ? 'default' : 'pointer',
                    flexShrink: 0, transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {ocFetching
                    ? <><span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #2a3060', borderTop: '2px solid #4a70ae', borderRadius: '50%', animation: 'spinBtn 0.8s linear infinite' }} /> Fetching</>
                    : '↓ Fetch'
                  }
                </button>
              </div>
              {ocError && (
                <div style={{ marginTop: 5, fontSize: 11, color: '#e08080' }}>{ocError}</div>
              )}
              {ocSuccess && !ocError && (
                <div style={{ marginTop: 5, fontSize: 11, color: '#6abf6a' }}>{ocSuccess}</div>
              )}
              <div style={{ marginTop: 5, fontSize: 10, color: textSecondary, opacity: 0.35 }}>
                Find the URL on opencritic.com — search for the game and copy the page URL
              </div>
            </div>
          )}
        </Section>

        {/* Details */}
        <Section title="Details" textSecondary={textSecondary}>
          <InfoRow label="Platform"  value={game.platform}    fontSizeLabel={fontSizeLabel} textSecondary={textSecondary} />
          {formatSize(game.sizeBytes) && <InfoRow label="Size" value={formatSize(game.sizeBytes)} fontSizeLabel={fontSizeLabel} textSecondary={textSecondary} />}
          {game.installDir && <InfoRow label="Path"   value={game.installDir} fontSizeLabel={fontSizeLabel} textSecondary={textSecondary} mono />}
          {game.appId      && <InfoRow label="App ID" value={game.appId}      fontSizeLabel={fontSizeLabel} textSecondary={textSecondary} mono />}
        </Section>

        {/* Launch */}
        <button
          onClick={handleLaunch}
          disabled={launching}
          style={{
            width: '100%', padding: '13px',
            background: launching ? '#1e2540' : 'linear-gradient(135deg,#1e3a6e,#2e5fae)',
            border: 'none', borderRadius: 10,
            color: launching ? '#3a5a8e' : '#c0d8f8',
            fontFamily: 'Bebas Neue, cursive',
            fontSize: 17, letterSpacing: '0.12em',
            boxShadow: launching ? 'none' : '0 4px 18px rgba(46,123,207,0.22)',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
          onMouseEnter={e => { if (!launching) e.currentTarget.style.filter = 'brightness(1.12)' }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
        >
          {launching
            ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #1e3060', borderTop: '2px solid #4a70ae', borderRadius: '50%', animation: 'spinBtn 0.8s linear infinite' }} /> LAUNCHING...</>
            : '▶ Launch Game'
          }
        </button>
      </div>
    </div>
  )
}

function Section({ title, children, textSecondary }) {
  return (
    <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: textSecondary, opacity: 0.45, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 9 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono, fontSizeLabel, textSecondary }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: fontSizeLabel || 11, color: textSecondary, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: fontSizeLabel || 11, color: textSecondary, textAlign: 'right', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : 'inherit', maxWidth: 190 }}>
        {value}
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
  ]
  return (
    <div style={{
      width: '100%', height: '100%',
      background: gradients[game.title.charCodeAt(0) % gradients.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 52, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
        {initials}
      </span>
    </div>
  )
}
