import { useState } from 'react'

export default function SetupScreen({ onSave }) {
  const [apiKey, setApiKey]   = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError]     = useState('')

  function handleSave() {
    if (!apiKey.trim()) {
      setError('Please enter your SteamGridDB API key.')
      return
    }
    onSave({ sgdbApiKey: apiKey.trim() })
  }

  return (
    <div style={{
      height: '100vh', background: '#1a1d27',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Segoe UI, sans-serif',
    }}>
      <div style={{
        width: 520,
        background: '#161820',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: '36px 40px 40px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 32, color: '#d4d6e0', letterSpacing: '0.1em', marginBottom: 6 }}>
            PeliVeli
          </div>
          <div style={{ fontSize: 13, color: '#7a7f9a', lineHeight: 1.6 }}>
            PeliVeli uses <strong style={{ color: '#a0b8d0' }}>SteamGridDB</strong> to fetch cover art
            for Epic, Ubisoft, EA, and GOG games. A free API key is required.
            Steam cover art is always fetched automatically with no key needed.
          </div>
        </div>

        {/* Steps */}
        <div style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#4a80c0', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
            How to get your free API key (1 minute)
          </div>
          {[
            ['1', 'Go to', 'steamgriddb.com', 'https://www.steamgriddb.com', ' and sign in with your Steam account'],
            ['2', 'Click your avatar (top right) →', 'Preferences', null, null],
            ['3', 'Click the', 'API', null, ' tab'],
            ['4', 'Click', 'Generate API Key', null, ' and copy it'],
          ].map(([n, pre, highlight, href, post]) => (
            <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 7, fontSize: 12, color: '#7a7f9a', lineHeight: 1.5 }}>
              <span style={{ width: 18, height: 18, background: '#252838', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#4a80c0', fontWeight: 700, marginTop: 1 }}>{n}</span>
              <span>
                {pre}{' '}
                {href
                  ? <a href={href} target="_blank" rel="noreferrer" style={{ color: '#4a90c0', textDecoration: 'none' }}>{highlight}</a>
                  : <strong style={{ color: '#c0cce0' }}>{highlight}</strong>
                }
                {post}
              </span>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ marginBottom: 22, position: 'relative' }}>
          <label style={{ display: 'block', fontSize: 11, color: '#7a7f9a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            SteamGridDB API Key
          </label>
          <input
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setError('') }}
            type={showKey ? 'text' : 'password'}
            placeholder="Paste your API key here"
            autoComplete="off"
            style={{ width: '100%', background: '#252838', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 40px 9px 12px', color: '#d4d6e0', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }}
          />
          <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, bottom: 9, background: 'none', border: 'none', color: '#4a5068', cursor: 'pointer', fontSize: 13 }}>
            {showKey ? '🙈' : '👁'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(220,60,60,0.1)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onSave({ sgdbApiKey: '', skipSgdb: true })}
            style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#555a70', fontSize: 13, cursor: 'pointer' }}
          >
            Skip (Steam only)
          </button>
          <button
            onClick={handleSave}
            style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#1e3a6e,#2e5fae)', border: 'none', borderRadius: 9, color: '#c0d8f8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Save & Continue →
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#3a4060', lineHeight: 1.6, textAlign: 'center' }}>
          Your API key is stored locally on this machine only.
        </div>
      </div>
    </div>
  )
}
