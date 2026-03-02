export default function ProgressOverlay({ phase, message }) {
  const label = phase==='scan' ? 'Scanning Library' : 'Fetching Art & Scores'
  return (
    <div style={{
      position:'fixed', bottom:22, left:'50%', transform:'translateX(-50%)',
      background:'#1e2130', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:12, padding:'12px 20px',
      display:'flex', alignItems:'center', gap:12,
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
      zIndex:200, maxWidth:480, minWidth:300,
      animation:'fadeInUp 0.2s ease',
    }}>
      <div style={{ width:16, height:16, flexShrink:0, border:'2px solid #252840', borderTop:'2px solid #4a80c0', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'Bebas Neue, cursive', fontSize:12, color:'#6a80b0', letterSpacing:'0.12em', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:11, color:'#3a4060', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{message}</div>
      </div>
    </div>
  )
}
