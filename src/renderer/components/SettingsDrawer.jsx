import { useState, useEffect } from 'react'

const PLATFORMS = ['Steam','Epic','GOG','Ubisoft','EA']
const CARD_SIZES = [
  { value:'small',  label:'Small',  desc:'~118px' },
  { value:'medium', label:'Medium', desc:'~152px' },
  { value:'large',  label:'Large',  desc:'~198px' },
]

export default function SettingsDrawer({ settings, onSave, onClose, onReEnrich, onReconfigure }) {
  const [local, setLocal]               = useState(() => JSON.parse(JSON.stringify(settings)))
  const [fonts, setFonts]               = useState([])
  const [loadingFonts, setLoadingFonts] = useState(true)
  const [activeTab, setActiveTab]       = useState('appearance')

  useEffect(() => {
    window.peliVeli.listFonts().then(list => { setFonts(list); setLoadingFonts(false) })
  }, [])

  function updatePlatformColor(platform, key, value) {
    setLocal(s => ({ ...s, platformColors: { ...s.platformColors, [platform]: { ...s.platformColors[platform], [key]: value } } }))
  }

  const font    = local.fontFamily         || 'Segoe UI'
  const primary = local.fontColorPrimary   || '#d4d6e0'
  const second  = local.fontColorSecondary || '#7a7f9a'
  const base    = local.fontSizeBase       || 13
  const lbl     = local.fontSizeLabel      || 11

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:200, display:'flex' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.55)' }} />

      <div style={{
        width: 430, background: '#161820',
        borderLeft: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
        animation: 'slideInPanel 0.22s ease',
        overflow: 'hidden',
        fontFamily: font, color: primary, fontSize: base,
      }}>

        {/* Header — close button on LEFT to avoid Windows titlebar controls */}
        <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <button onClick={onClose} title="Close settings" style={{
            background:'rgba(255,255,255,0.07)', border:'none', color:second,
            borderRadius:7, width:28, height:28, cursor:'pointer',
            fontSize:17, lineHeight:1, flexShrink:0, transition:'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
          >×</button>
          <h2 style={{ fontFamily:'Bebas Neue, cursive', fontSize:22, letterSpacing:'0.08em', color:primary, margin:0 }}>⚙ Settings</h2>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
          {[['appearance','Appearance'],['platforms','Platforms'],['library','Library'],['account','Account']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              flex:1, padding:'10px 4px', background:'transparent', border:'none',
              borderBottom:`2px solid ${activeTab===id ? '#4a80c0' : 'transparent'}`,
              color: activeTab===id ? '#90b8f0' : second,
              fontSize:lbl, fontWeight:600, letterSpacing:'0.05em',
              cursor:'pointer', transition:'all 0.15s', fontFamily:font,
            }}>{label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

          {activeTab==='appearance' && (
            <div>
              <Group label="Font Family" primary={primary} second={second}>
                {loadingFonts
                  ? <div style={{ fontSize:lbl, color:second, padding:'8px 0' }}>Loading system fonts…</div>
                  : <select value={local.fontFamily} onChange={e => setLocal(s => ({...s, fontFamily:e.target.value}))}
                      style={{ width:'100%', background:'#1e2130', border:'1px solid rgba(255,255,255,0.09)', borderRadius:8, padding:'8px 12px', fontSize:base, cursor:'pointer', color:primary, fontFamily:local.fontFamily }}>
                      {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                }
                <div style={{ marginTop:8, padding:'8px 12px', background:'#1e2130', borderRadius:8, fontSize:base, color:primary, fontFamily:font }}>
                  The quick brown fox jumps over the lazy dog
                </div>
              </Group>

              <Group label="Font Sizes" primary={primary} second={second}>
                <Slider label="Body text"   value={local.fontSizeBase}  min={10} max={18} onChange={v=>setLocal(s=>({...s,fontSizeBase:v}))}  primary={primary} second={second} />
                <Slider label="Game titles" value={local.fontSizeTitle} min={10} max={22} onChange={v=>setLocal(s=>({...s,fontSizeTitle:v}))} primary={primary} second={second} />
                <Slider label="Labels"      value={local.fontSizeLabel} min={8}  max={15} onChange={v=>setLocal(s=>({...s,fontSizeLabel:v}))} primary={primary} second={second} />
              </Group>

              <Group label="Font Colours" primary={primary} second={second}>
                <ColorRow
                  label="Primary text (titles, main content)"
                  value={local.fontColorPrimary||'#d4d6e0'}
                  preview="Sample primary text"
                  previewColor={local.fontColorPrimary||'#d4d6e0'}
                  previewSize={base} font={font} second={second}
                  onChange={v=>setLocal(s=>({...s,fontColorPrimary:v}))}
                />
                <ColorRow
                  label="Secondary text (labels, hints, metadata)"
                  value={local.fontColorSecondary||'#7a7f9a'}
                  preview="Sample secondary text"
                  previewColor={local.fontColorSecondary||'#7a7f9a'}
                  previewSize={lbl} font={font} second={second}
                  onChange={v=>setLocal(s=>({...s,fontColorSecondary:v}))}
                />
              </Group>
            </div>
          )}

          {activeTab==='platforms' && (
            <div>
              <p style={{ fontSize:lbl, color:second, marginBottom:16, lineHeight:1.6 }}>
                Set each platform's accent colour and how strongly it tints card backgrounds.
              </p>
              {PLATFORMS.map(p => {
                const pc = local.platformColors[p] || { primary:'#888888', intensity:0.12 }
                return (
                  <Group key={p} label={p} primary={primary} second={second}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                      <input type="color" value={pc.primary} onChange={e=>updatePlatformColor(p,'primary',e.target.value)}
                        style={{ width:40, height:34, border:'none', borderRadius:6, cursor:'pointer', background:'none' }} />
                      {/* White text on tinted bg so platform name is always readable */}
                      <div style={{ flex:1, height:34, borderRadius:8, background:`linear-gradient(135deg,${pc.primary}50,${pc.primary}88)`, border:`1px solid ${pc.primary}70`, display:'flex', alignItems:'center', paddingLeft:14 }}>
                        <span style={{ fontSize:lbl, color:'#ffffff', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', textShadow:'0 1px 3px rgba(0,0,0,0.6)' }}>{p}</span>
                      </div>
                    </div>
                    <Slider label={`Background intensity  ${Math.round(pc.intensity*100)}%`} value={Math.round(pc.intensity*100)} min={0} max={60} onChange={v=>updatePlatformColor(p,'intensity',v/100)} primary={primary} second={second} />
                  </Group>
                )
              })}
            </div>
          )}

          {activeTab==='library' && (
            <div>
              <Group label="Cover Size" primary={primary} second={second}>
                <div style={{ display:'flex', gap:8 }}>
                  {CARD_SIZES.map(({value,label,desc}) => (
                    <button key={value} onClick={()=>setLocal(s=>({...s,cardSize:value}))} style={{
                      flex:1, padding:'10px 8px',
                      background: local.cardSize===value ? 'rgba(74,128,192,0.18)' : '#1e2130',
                      border: `1px solid ${local.cardSize===value ? '#4a80c055' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius:9, cursor:'pointer', transition:'all 0.15s', fontFamily:font,
                    }}>
                      <div style={{ fontSize:base, color: local.cardSize===value ? '#90b8f0' : primary, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:10, color:second, marginTop:2, opacity:0.6 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </Group>

              <Group label="Game Cards" primary={primary} second={second}>
                <Toggle label="Show install size on cards" description="Displays a size badge (e.g. 48 GB) on each game card opposite the platform badge."
                  value={local.showSizeOnCards||false} onChange={v=>setLocal(s=>({...s,showSizeOnCards:v}))} primary={primary} second={second} base={base} lbl={lbl} />
                <div style={{ marginTop:14 }}>
                  <Toggle label="Show hidden games" description="Reveals games you've hidden. Open a hidden game's detail panel to unhide it."
                    value={local.showHiddenGames||false} onChange={v=>setLocal(s=>({...s,showHiddenGames:v}))} primary={primary} second={second} base={base} lbl={lbl} />
                </div>
              </Group>

              <Group label="Cover Art & Scores" primary={primary} second={second}>
                <p style={{ fontSize:lbl, color:second, marginBottom:10, lineHeight:1.6 }}>
                  Re-fetch all cover art and OpenCritic scores from scratch. Useful if images failed during the initial scan.
                </p>
                <ActionBtn onClick={()=>{ onReEnrich(); onClose() }} primary={primary}>↺ Re-fetch Cover Art & Scores</ActionBtn>
              </Group>
            </div>
          )}

          {activeTab==='account' && (
            <div>
              <Group label="SteamGridDB API Key" primary={primary} second={second}>
                <p style={{ fontSize:lbl, color:second, marginBottom:12, lineHeight:1.6 }}>
                  Used to fetch cover art for Epic, Ubisoft, EA, and GOG games.
                  Steam cover art is always fetched automatically with no key needed.
                  Get a free key at <strong style={{color:'#4a90c0'}}>steamgriddb.com</strong> → Preferences → API.
                </p>
                <ActionBtn onClick={onReconfigure} primary={primary}>Update SteamGridDB Key</ActionBtn>
              </Group>

              <Group label="Diagnostics" primary={primary} second={second}>
                <p style={{ fontSize:lbl, color:second, marginBottom:12, lineHeight:1.6 }}>
                  After running a scan, a debug log records every OpenCritic API attempt and response. Open it in Notepad to diagnose missing scores.
                </p>
                <ActionBtn primary={primary} onClick={async () => {
                  const p = await window.peliVeli.getDebugLogPath()
                  navigator.clipboard?.writeText(p).catch(()=>{})
                  alert('Log path copied to clipboard:\n' + p)
                }}>📋 Copy Log File Path</ActionBtn>
              </Group>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'13px 22px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'transparent', border:'1px solid rgba(255,255,255,0.09)', borderRadius:9, color:second, fontSize:base, fontWeight:600, cursor:'pointer', fontFamily:font }}>Cancel</button>
          <button onClick={()=>{ onSave(local); onClose() }} style={{ flex:2, padding:'10px', background:'linear-gradient(135deg,#1e3a6e,#2e5fae)', border:'1px solid #2e5fae55', borderRadius:9, color:'#a0c0f0', fontSize:base, fontWeight:600, cursor:'pointer', fontFamily:font }}>Save Settings</button>
        </div>
      </div>
    </div>
  )
}

function Group({ label, children, primary, second }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:10, color:second, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:10, fontWeight:600, opacity:0.85 }}>{label}</div>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, onChange, primary, second }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:12, color:second }}>{label}</span>
        <span style={{ fontSize:12, color:primary, fontWeight:600 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(parseInt(e.target.value))} style={{ width:'100%', accentColor:'#4a80c0', cursor:'pointer' }} />
    </div>
  )
}

function ColorRow({ label, value, preview, previewColor, previewSize, font, second, onChange }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:second, marginBottom:6 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)} style={{ width:40, height:34, border:'none', borderRadius:6, cursor:'pointer', background:'none' }} />
        <div style={{ flex:1, padding:'8px 14px', background:'#1e2130', borderRadius:8, fontSize:previewSize, color:previewColor, fontFamily:font }}>{preview}</div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, children, primary }) {
  return (
    <button onClick={onClick} style={{ width:'100%', padding:'10px', background:'#1e2130', border:'1px solid rgba(255,255,255,0.09)', borderRadius:9, color:primary, fontSize:13, fontWeight:600, letterSpacing:'0.04em', cursor:'pointer', transition:'all 0.15s' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.22)'; e.currentTarget.style.background='#252838' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; e.currentTarget.style.background='#1e2130' }}
    >{children}</button>
  )
}

function Toggle({ label, description, value, onChange, primary, second, base, lbl }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:4 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:base, color:primary, marginBottom:description?3:0 }}>{label}</div>
        {description && <div style={{ fontSize:lbl, color:second, opacity:0.7, lineHeight:1.5 }}>{description}</div>}
      </div>
      <button onClick={()=>onChange(!value)} style={{ flexShrink:0, width:42, height:24, borderRadius:12, background:value?'#2e5fae':'#252838', border:`1px solid ${value?'#4a80c0':'rgba(255,255,255,0.12)'}`, position:'relative', cursor:'pointer', transition:'all 0.2s' }}>
        <span style={{ position:'absolute', top:3, left:value?20:3, width:16, height:16, borderRadius:'50%', background:value?'#c0d8f8':'#555a70', transition:'all 0.2s', display:'block' }} />
      </button>
    </div>
  )
}
