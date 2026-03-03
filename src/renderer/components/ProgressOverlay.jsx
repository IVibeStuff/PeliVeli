export default function ProgressOverlay({ phase, message }) {
  const label = phase === 'scan' ? 'Scanning Library' : 'Fetching Art & Scores'

  return (
    <div style={{
      position: 'fixed',
      bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      background: '#171922',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '14px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      zIndex: 200,
      maxWidth: 480,
      minWidth: 320,
      animation: 'fadeInUp 0.2s ease',
    }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spinOverlay {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Spinner */}
      <div style={{
        width: 18, height: 18, flexShrink: 0,
        border: '2px solid #1e2a40',
        borderTop: '2px solid #4a80c0',
        borderRadius: '50%',
        animation: 'spinOverlay 0.8s linear infinite',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 13, color: '#6a80b0',
          letterSpacing: '0.12em',
          marginBottom: 3,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 12, color: '#333a50',
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {message}
        </div>
      </div>
    </div>
  )
}
