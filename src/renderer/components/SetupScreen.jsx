import { useState } from 'react'

export default function SetupScreen({ onComplete }) {
  const [apiKey, setApiKey]   = useState('')
  const [skipKey, setSkipKey] = useState(false)

  function handleSubmit() {
    onComplete(skipKey ? '' : apiKey.trim())
  }

  const canProceed = skipKey || apiKey.trim().length > 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0c0e16',
      backgroundImage: 'radial-gradient(ellipse at 30% 50%, #0d1428 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, #0a0f1e 0%, transparent 50%)',
    }}>
      <div style={{
        width: 480,
        background: '#0f1118',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '40px 40px 36px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 42, letterSpacing: '0.12em',
            color: '#e8eaf0', lineHeight: 1,
          }}>PeliVeli</div>
          <div style={{ fontSize: 11, color: '#6a7490', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>
            Game Library
          </div>
        </div>

        <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, fontWeight: 700, color: '#b0bcd0', marginBottom: 6, letterSpacing: '0.05em' }}>
          Welcome to PeliVeli
        </h2>
        <p style={{ fontSize: 13, color: '#8090a8', lineHeight: 1.6, marginBottom: 28 }}>
          PeliVeli uses <strong style={{ color: '#7ab0d8' }}>SteamGridDB</strong> to fetch high-quality cover art for your games.
          A free API key is required. You can skip this for now and add it later from Settings.
        </p>

        <a
          href="https://www.steamgriddb.com/profile/preferences/api"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block', fontSize: 12, color: '#6aa0e0',
            marginBottom: 24, textDecoration: 'none', letterSpacing: '0.04em',
          }}
        >
          → Get a free API key at steamgriddb.com
        </a>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#8090a8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            SteamGridDB API Key
          </label>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={skipKey}
            placeholder="Paste your API key here"
            style={{
              width: '100%', padding: '10px 14px',
              background: skipKey ? '#0c0e14' : '#171922',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: skipKey ? '#6a7490' : '#c8cad8',
              fontSize: 13, letterSpacing: '0.03em', outline: 'none',
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={skipKey}
            onChange={e => setSkipKey(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: '#2e7bcf' }}
          />
          <span style={{ fontSize: 13, color: '#8090a8' }}>
            Skip for now — I'll add the API key later in Settings
          </span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!canProceed}
          style={{
            width: '100%', padding: '13px',
            background: canProceed ? 'linear-gradient(135deg, #1e3a6e, #2e5fae)' : '#141620',
            border: `1px solid ${canProceed ? '#2e5fae' : '#1e2030'}`,
            borderRadius: 9,
            color: canProceed ? '#90b8f0' : '#6070a0',
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 18, letterSpacing: '0.12em',
            cursor: canProceed ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          Launch PeliVeli
        </button>

        <p style={{ fontSize: 11, color: '#6070a0', textAlign: 'center', marginTop: 16, letterSpacing: '0.05em' }}>
          You can add or change your API key at any time from Settings.
        </p>
      </div>
    </div>
  )
}
