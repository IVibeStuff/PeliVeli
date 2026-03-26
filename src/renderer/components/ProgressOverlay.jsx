import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

function isLight(hex) {
  try {
    const c = (hex || '').replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
    return (r*299 + g*587 + b*114) / 1000 > 160
  } catch(_) { return false }
}

export default function ProgressOverlay({ phase, message }) {
  const s     = useContext(SettingsContext)
  const label = phase === 'scan' ? 'Scanning Library' : 'Fetching Cover Art'
  const appBg = s.appBackground || '#0c0e16'
  const light = isLight(appBg)
  const bg       = light ? (s.appBackground || '#f0ede6')  : (s.drawerBackground || '#171922')
  const border   = light ? 'rgba(0,0,0,0.14)'              : 'rgba(255,255,255,0.10)'
  const labelCol = light ? '#3a4a6a'                        : '#6a80b0'
  const msgCol   = light ? '#5a5a4a'                        : '#8090a8'
  const spinBg   = light ? 'rgba(0,0,0,0.12)'              : '#1e2a40'
  const spinFg   = light ? 'rgba(0,0,0,0.5)'               : '#4a80c0'
  const font     = s.fontFamily || 'Calibri'
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      background:bg, border:'1px solid '+border, borderRadius:10,
      padding:'14px 22px', display:'flex', alignItems:'center', gap:14,
      boxShadow: light ? '0 8px 32px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.6)',
      zIndex:200, maxWidth:480, minWidth:320, animation:'fadeInUp 0.2s ease', fontFamily:font,
    }}>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spinOverlay { to{transform:rotate(360deg)} }
      `}</style>
      <div style={{ width:18,height:18,flexShrink:0, border:'2px solid '+spinBg, borderTop:'2px solid '+spinFg, borderRadius:'50%', animation:'spinOverlay 0.8s linear infinite' }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:13, color:labelCol, letterSpacing:'0.12em', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:12, color:msgCol, letterSpacing:'0.03em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{message}</div>
      </div>
    </div>
  )
}
