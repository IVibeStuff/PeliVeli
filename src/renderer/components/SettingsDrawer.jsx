import { useState, useEffect } from 'react'

const PLATFORMS  = ['Steam','Epic','GOG','Ubisoft','EA']
const CARD_SIZES = [
  { value:'small',  label:'Small',  desc:'~118px' },
  { value:'medium', label:'Medium', desc:'~152px' },
  { value:'large',  label:'Large',  desc:'~198px' },
]

// ── Theme preset definitions ─────────────────────────────────────────────────
const THEME_PRESETS = [
  {
    id: 'default',
    name: 'Default Dark',
    sub: 'Deep navy · Blue accents',
    swatch: ['#0f1118','#1a9fff','#ffffff','#a0a8b8'],
    settings: {
      fontFamily: 'Calibri', fontSizeBase: 13, fontSizeTitle: 15, fontSizeLabel: 11,
      fontColorPrimary: '#ffffff', fontColorSecondary: '#a0a8b8',
      appBackground: '#0c0e16', topbarBackground: '#0f1118', sidebarBackground: '#0c0e16',
      drawerBackground: '#161820',
      drawerColorPrimary: '#ffffff', drawerColorSecondary: '#a0a8b8',
      borderColor: 'rgba(255,255,255,0.06)',
      platformColors: {
        Steam:   { primary: '#1a9fff', intensity: 0.12 },
        Epic:    { primary: '#a0a0a0', intensity: 0.10 },
        GOG:     { primary: '#a855f7', intensity: 0.10 },
        Ubisoft: { primary: '#0070ff', intensity: 0.10 },
        EA:      { primary: '#ff6b35', intensity: 0.10 },
      },
    },
  },
  {
    id: 'nasa',
    name: 'NASA-PUNK',
    sub: 'Starfield · Parchment & ink',
    swatch: ['#f0ede6','#1a1a14','#e8e4da','#c8922a'],
    settings: {
      fontFamily: 'Calibri', fontSizeBase: 13, fontSizeTitle: 14, fontSizeLabel: 11,
      fontColorPrimary: '#1a1a14', fontColorSecondary: '#e8e4e0',
      appBackground: '#f0ede6', topbarBackground: '#e8e4da', sidebarBackground: '#e8e4da',
      drawerBackground: '#1a1a14',
      drawerColorPrimary: '#e8e4e0', drawerColorSecondary: '#9a9890',
      borderColor: 'rgba(26,26,20,0.18)',
      platformColors: {
        Steam:   { primary: '#1a1a14', intensity: 0.08 },
        Epic:    { primary: '#3a3a2a', intensity: 0.07 },
        GOG:     { primary: '#c8922a', intensity: 0.10 },
        Ubisoft: { primary: '#1a1a14', intensity: 0.08 },
        EA:      { primary: '#3a3a2a', intensity: 0.07 },
      },
    },
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function SettingsDrawer({ settings, onSave, onClose, onReEnrich, onReconfigure, customThemes = [], onCustomThemesChange }) {
  const [local, setLocal]               = useState(() => JSON.parse(JSON.stringify(settings)))
  const [fonts, setFonts]               = useState([])
  const [loadingFonts, setLoadingFonts] = useState(true)
  const [activeTab, setActiveTab]       = useState('themes')
  const [appliedPreset, setAppliedPreset] = useState(null)

  const [themesDir, setThemesDir] = useState('')
  const [themeMsg, setThemeMsg]   = useState(null)  // { type: 'ok'|'err', text }

  useEffect(() => {
    window.peliVeli.listFonts().then(list => { setFonts(list); setLoadingFonts(false) })
    window.peliVeli.getThemesDir().then(d => setThemesDir(d))
  }, [])

  async function handleInstallTheme() {
    setThemeMsg(null)
    const result = await window.peliVeli.installTheme()
    if (result.success) {
      onCustomThemesChange(prev => {
        const without = prev.filter(t => t._filename !== result.theme._filename)
        return [...without, result.theme]
      })
      setThemeMsg({ type: 'ok', text: `"${result.theme.name}" installed successfully.` })
    } else if (result.reason !== 'cancelled') {
      const msgs = { invalid_json: "That file isn't valid JSON.", missing_name: "Theme file must have a \"name\" field." }
      setThemeMsg({ type: 'err', text: msgs[result.reason] || 'Installation failed.' })
    }
  }

  async function handleDeleteTheme(theme) {
    const result = await window.peliVeli.deleteTheme(theme._filename)
    if (result.success) {
      onCustomThemesChange(prev => prev.filter(t => t._filename !== theme._filename))
      if (appliedPreset === theme._filename) setAppliedPreset(null)
      setThemeMsg({ type: 'ok', text: `"${theme.name}" removed.` })
    }
  }

  async function handleExportTheme() {
    setThemeMsg(null)
    const exportSettings = {
      ...local,
      name: local.exportName || 'My PeliVeli Theme',
      author: local.exportAuthor || '',
    }
    const result = await window.peliVeli.exportTheme(exportSettings)
    if (result.success) {
      setThemeMsg({ type: 'ok', text: 'Theme exported successfully.' })
    } else if (result.reason !== 'cancelled') {
      setThemeMsg({ type: 'err', text: 'Export failed.' })
    }
  }

  function applyPreset(preset) {
    // Built-in presets have a nested `settings` object; custom themes are flat JSON
    const themeData = preset.settings || preset
    const id = preset._custom ? preset._filename : preset.id
    setAppliedPreset(id)
    setLocal(prev => ({
      ...prev,
      ...themeData,
      platformColors: { ...prev.platformColors, ...(themeData.platformColors || {}) },
      // always preserve library/display settings — themes don't control these
      cardSize:        prev.cardSize,
      showSizeOnCards: prev.showSizeOnCards,
      showHiddenGames: prev.showHiddenGames,
      scoreBadgeStyle: prev.scoreBadgeStyle,
    }))
  }

  function updatePlatformColor(platform, key, value) {
    setLocal(s => ({ ...s, platformColors: { ...s.platformColors, [platform]: { ...s.platformColors[platform], [key]: value } } }))
  }

  const font = local.fontFamily         || 'Segoe UI'
  // In drawer, use drawerColor* if set (handles themes like NASA-PUNK where app bg is light but drawer is dark)
  const pri  = local.drawerColorPrimary   || local.fontColorPrimary   || '#d4d6e0'
  const sec  = local.drawerColorSecondary || local.fontColorSecondary || '#7a7f9a'
  const base = local.fontSizeBase       || 13
  const lbl  = local.fontSizeLabel      || 11

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:200, display:'flex' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.55)' }} />
      <div style={{
        width: 440, background: local.drawerBackground || '#161820', borderLeft:'1px solid rgba(128,128,128,0.15)',
        display:'flex', flexDirection:'column', boxShadow:'-20px 0 60px rgba(0,0,0,0.6)',
        animation:'slideInPanel 0.22s ease', overflow:'hidden', fontFamily:font, color:pri, fontSize:base,
      }}>

        {/* Header */}
        <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)',
          display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <button onClick={onClose} style={{
            background:'rgba(128,128,128,0.15)', border:'none', color:sec,
            borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:17, lineHeight:1,
            flexShrink:0, transition:'background 0.15s', display:'flex', alignItems:'center', justifyContent:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}
          >×</button>
          <h2 style={{ fontFamily:'Bebas Neue, cursive', fontSize:22, letterSpacing:'0.08em', color:pri, margin:0 }}>⚙ Settings</h2>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(128,128,128,0.15)', flexShrink:0 }}>
          {[['themes','Themes'],['appearance','Appearance'],['platforms','Platforms'],['library','Library'],['account','Account']].map(([id,label]) => (
            <button key={id} onClick={()=>setActiveTab(id)} style={{
              flex:1, padding:'10px 2px', background:'transparent', border:'none',
              borderBottom:`2px solid ${activeTab===id ? '#4a80c0' : 'transparent'}`,
              color: activeTab===id ? '#90b8f0' : sec,
              fontSize: 10, fontWeight:600, letterSpacing:'0.05em', cursor:'pointer',
              transition:'all 0.15s', fontFamily:font }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

          {/* ── THEMES TAB ── */}
          {activeTab==='themes' && (
            <div>

              {/* Status message */}
              {themeMsg && (
                <div style={{ marginBottom:14, padding:'9px 13px', borderRadius:8,
                  background: themeMsg.type==='ok' ? 'rgba(0,200,100,0.1)' : 'rgba(220,60,60,0.1)',
                  border: `1px solid ${themeMsg.type==='ok' ? '#00c86433' : '#dc3c3c33'}`,
                  color: themeMsg.type==='ok' ? '#60d890' : '#e07070',
                  fontSize:lbl, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <span>{themeMsg.text}</span>
                  <button onClick={()=>setThemeMsg(null)} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:14, lineHeight:1, opacity:0.6 }}>×</button>
                </div>
              )}

              {/* Built-in presets */}
              <div style={{ fontSize:10, color:sec, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:10, fontWeight:600, opacity:0.85 }}>Built-in Presets</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:22 }}>
                {THEME_PRESETS.map(preset => {
                  const isActive = appliedPreset === preset.id
                  return (
                    <button key={preset.id} onClick={()=>applyPreset(preset)} style={{
                      display:'flex', alignItems:'center', gap:14, padding:'10px 12px',
                      background: isActive ? 'rgba(74,128,192,0.15)' : 'rgba(128,128,128,0.12)',
                      border:`1px solid ${isActive ? '#4a80c055' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius:9, cursor:'pointer', transition:'all 0.15s', textAlign:'left',
                    }}
                      onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background='rgba(128,128,128,0.25)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)' }}}
                      onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background='rgba(128,128,128,0.12)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)' }}}
                    >
                      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                        {preset.swatch.map((c,i) => (
                          <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:c, border:'1px solid rgba(255,255,255,0.12)', flexShrink:0 }} />
                        ))}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:base, fontWeight:700, color: isActive ? '#90b8f0' : pri,
                          fontFamily: preset.id==='darkfantasy' ? 'Georgia,serif' : ['nasa','nightcity','engineering'].includes(preset.id) ? 'Courier New,monospace' : 'inherit' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize:lbl, color:sec, opacity:0.7, marginTop:1 }}>{preset.sub}</div>
                      </div>
                      {isActive && <span style={{ fontSize:9, color:'#90b8f0', fontWeight:700, letterSpacing:'0.06em' }}>✓ APPLIED</span>}
                    </button>
                  )
                })}
              </div>

              {/* Custom themes */}
              <div style={{ fontSize:10, color:sec, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:10, fontWeight:600, opacity:0.85 }}>Custom Themes</div>
              {customThemes.length === 0
                ? <div style={{ fontSize:lbl, color:sec, opacity:0.5, marginBottom:14, padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px dashed rgba(255,255,255,0.08)' }}>
                    No custom themes installed yet. Drop a <code style={{fontFamily:'Courier New',fontSize:10}}>.json</code> file into your themes folder or use the button below.
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
                    {customThemes.map(theme => {
                      const isActive = appliedPreset === theme._filename
                      const swatchColors = [
                        theme.appBackground, theme.topbarBackground,
                        theme.fontColorPrimary, theme.fontColorSecondary,
                      ].filter(Boolean)
                      return (
                        <div key={theme._filename} style={{
                          display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                          background: isActive ? 'rgba(74,128,192,0.12)' : 'rgba(128,128,128,0.12)',
                          border:`1px solid ${isActive ? '#4a80c044' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius:9,
                        }}>
                          {/* swatches */}
                          <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                            {swatchColors.slice(0,4).map((c,i) => (
                              <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:c, border:'1px solid rgba(255,255,255,0.12)' }} />
                            ))}
                          </div>
                          {/* name */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:base, fontWeight:700, color: isActive ? '#90b8f0' : pri, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{theme.name}</div>
                            {theme.author && <div style={{ fontSize:10, color:sec, opacity:0.6, marginTop:1 }}>by {theme.author}</div>}
                          </div>
                          {/* custom tag */}
                          <span style={{ fontSize:9, color:'#a060ff', fontWeight:700, letterSpacing:'0.06em', background:'rgba(160,96,255,0.12)', padding:'2px 6px', borderRadius:4, flexShrink:0 }}>CUSTOM</span>
                          {isActive && <span style={{ fontSize:9, color:'#90b8f0', fontWeight:700, letterSpacing:'0.06em', flexShrink:0 }}>✓</span>}
                          {/* apply */}
                          <button onClick={()=>applyPreset(theme)} style={{
                            padding:'5px 10px', background: isActive ? 'rgba(74,128,192,0.2)' : 'rgba(255,255,255,0.06)',
                            border:`1px solid ${isActive ? '#4a80c044' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius:6, color: isActive ? '#90b8f0' : sec, fontSize:10, fontWeight:600, cursor:'pointer', flexShrink:0,
                          }}>Apply</button>
                          {/* delete */}
                          <button onClick={()=>handleDeleteTheme(theme)} style={{
                            padding:'5px 8px', background:'rgba(220,60,60,0.08)', border:'1px solid rgba(220,60,60,0.2)',
                            borderRadius:6, color:'#e07070', fontSize:12, cursor:'pointer', flexShrink:0, lineHeight:1,
                          }} title="Remove theme">✕</button>
                        </div>
                      )
                    })}
                  </div>
              }

              {/* Install + Export buttons */}
              <div style={{ display:'flex', gap:8, marginBottom:24 }}>
                <ActionBtn onClick={handleInstallTheme} pri={pri} style={{ flex:1 }}>＋ Install Theme…</ActionBtn>
                <ActionBtn onClick={handleExportTheme} pri={pri} style={{ flex:1 }}>↑ Export Current Theme…</ActionBtn>
              </div>

              {/* ── Quick Guide ── */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:20 }}>
                <div style={{ fontSize:10, color:sec, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:14, fontWeight:600, opacity:0.85 }}>How to Create a Theme</div>

                <div style={{ fontSize:lbl, color:sec, lineHeight:1.75, marginBottom:14 }}>
                  A PeliVeli theme is a plain <code style={{fontFamily:'Courier New',fontSize:10,color:pri}}>JSON</code> file. Every property is optional — omitted values fall back to Default Dark. Save it with a <code style={{fontFamily:'Courier New',fontSize:10,color:pri}}>.json</code> extension and either use <strong style={{color:pri}}>Install Theme…</strong> above, or drop it directly into your themes folder.
                </div>

                {/* Themes folder path */}
                <div style={{ marginBottom:16, padding:'9px 12px', background:'rgba(128,128,128,0.1)', borderRadius:8, border:'1px solid rgba(128,128,128,0.15)' }}>
                  <div style={{ fontSize:9, color:sec, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:5, opacity:0.7 }}>Themes Folder</div>
                  <div style={{ fontFamily:'Courier New,monospace', fontSize:11, color:'#a0c0e0', wordBreak:'break-all' }}>{themesDir || 'Loading…'}</div>
                </div>

                {/* Schema reference */}
                <div style={{ fontSize:9, color:sec, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8, opacity:0.7 }}>Full Property Reference</div>
                <div style={{ fontFamily:'Courier New,monospace', fontSize:10, color:'#a0c8e0', background:'rgba(0,0,0,0.35)', borderRadius:8, padding:'12px 14px', lineHeight:1.9, border:'1px solid rgba(255,255,255,0.07)', overflowX:'auto', whiteSpace:'pre' }}>{`{
  // Required
  "name":    "My Theme",      // shown in the themes list

  // Optional metadata
  "author":  "Your Name",

  // Typography
  "fontFamily":          "Segoe UI",
  "fontSizeBase":        13,
  "fontSizeTitle":       15,
  "fontSizeLabel":       11,
  "fontColorPrimary":    "#d4d6e0",
  "fontColorSecondary":  "#7a7f9a",

  // Backgrounds
  "appBackground":       "#0c0e16",
  "topbarBackground":    "#0f1118",
  "sidebarBackground":   "#0c0e16",
  "borderColor":         "rgba(255,255,255,0.06)",

  // Platform accent colours (intensity = card tint, 0–1)
  "platformColors": {
    "Steam":   { "primary": "#1a9fff", "intensity": 0.12 },
    "Epic":    { "primary": "#a0a0a0", "intensity": 0.10 },
    "GOG":     { "primary": "#a855f7", "intensity": 0.10 },
    "Ubisoft": { "primary": "#0070ff", "intensity": 0.10 },
    "EA":      { "primary": "#ff6b35", "intensity": 0.10 }
  }
}`}</div>

                {/* Minimal example */}
                <div style={{ fontSize:9, color:sec, letterSpacing:'0.12em', textTransform:'uppercase', marginTop:16, marginBottom:8, opacity:0.7 }}>Minimal Example (only changes what it needs to)</div>
                <div style={{ fontFamily:'Courier New,monospace', fontSize:10, color:'#a0c8e0', background:'rgba(0,0,0,0.35)', borderRadius:8, padding:'12px 14px', lineHeight:1.9, border:'1px solid rgba(255,255,255,0.07)', overflowX:'auto', whiteSpace:'pre' }}>{`{
  "name":               "Sunset",
  "author":             "Jane",
  "appBackground":      "#1a0a0a",
  "topbarBackground":   "#120606",
  "sidebarBackground":  "#120606",
  "fontColorPrimary":   "#f0c8a0",
  "fontColorSecondary": "#a06040",
  "borderColor":        "rgba(200,80,40,0.15)"
}`}</div>

                <div style={{ fontSize:lbl, color:sec, opacity:0.55, marginTop:14, lineHeight:1.7 }}>
                  Tip: use <strong style={{color:pri}}>Export Current Theme…</strong> to save your current settings as a starting point, then edit the JSON in any text editor.
                </div>
              </div>

            </div>
          )}

          {/* ── APPEARANCE TAB ── */}
          {activeTab==='appearance' && (
            <div>
              <Group label="Font Family" sec={sec}>
                {loadingFonts
                  ? <div style={{ fontSize:lbl, color:sec, padding:'8px 0' }}>Loading system fonts…</div>
                  : <select value={local.fontFamily} onChange={e=>setLocal(s=>({...s,fontFamily:e.target.value}))}
                      style={{ width:'100%', background:'rgba(128,128,128,0.15)', border:'1px solid rgba(128,128,128,0.2)',
                        borderRadius:8, padding:'8px 12px', fontSize:base, cursor:'pointer', color:pri, fontFamily:local.fontFamily }}>
                      {fonts.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                }
                <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(128,128,128,0.12)', borderRadius:8, fontSize:base, color:pri, fontFamily:font }}>
                  The quick brown fox jumps over the lazy dog
                </div>
              </Group>

              <Group label="Font Sizes" sec={sec}>
                <Slider label="Body text"   value={local.fontSizeBase}  min={10} max={18} onChange={v=>setLocal(s=>({...s,fontSizeBase:v}))}  pri={pri} sec={sec} />
                <Slider label="Game titles" value={local.fontSizeTitle} min={10} max={22} onChange={v=>setLocal(s=>({...s,fontSizeTitle:v}))} pri={pri} sec={sec} />
                <Slider label="Labels"      value={local.fontSizeLabel} min={8}  max={15} onChange={v=>setLocal(s=>({...s,fontSizeLabel:v}))} pri={pri} sec={sec} />
              </Group>

              <Group label="Font Colours" sec={sec}>
                <ColorRow label="Primary text" value={local.fontColorPrimary||'#d4d6e0'} preview="Sample primary text"
                  previewColor={local.fontColorPrimary||'#d4d6e0'} previewSize={base} font={font} sec={sec}
                  onChange={v=>setLocal(s=>({...s,fontColorPrimary:v}))} />
                <ColorRow label="Secondary text" value={local.fontColorSecondary||'#7a7f9a'} preview="Sample secondary text"
                  previewColor={local.fontColorSecondary||'#7a7f9a'} previewSize={lbl} font={font} sec={sec}
                  onChange={v=>setLocal(s=>({...s,fontColorSecondary:v}))} />
              </Group>
            </div>
          )}

          {/* ── PLATFORMS TAB ── */}
          {activeTab==='platforms' && (
            <div>
              <p style={{ fontSize:lbl, color:sec, marginBottom:16, lineHeight:1.6 }}>
                Each platform's accent colour and card tint intensity.
              </p>
              {PLATFORMS.map(p => {
                const pc = (local.platformColors||{})[p] || { primary:'#888888', intensity:0.12 }
                return (
                  <Group key={p} label={p} sec={sec}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                      <input type="color" value={pc.primary} onChange={e=>updatePlatformColor(p,'primary',e.target.value)}
                        style={{ width:40, height:34, border:'none', borderRadius:6, cursor:'pointer', background:'none' }} />
                      <div style={{ flex:1, height:34, borderRadius:8,
                        background:`linear-gradient(135deg,${pc.primary}50,${pc.primary}88)`,
                        border:`1px solid ${pc.primary}70`, display:'flex', alignItems:'center', paddingLeft:14 }}>
                        <span style={{ fontSize:lbl, color:'#ffffff', fontWeight:700, letterSpacing:'0.08em',
                          textTransform:'uppercase', textShadow:'0 1px 3px rgba(0,0,0,0.7)' }}>{p}</span>
                      </div>
                    </div>
                    <Slider label={`Background intensity  ${Math.round(pc.intensity*100)}%`}
                      value={Math.round(pc.intensity*100)} min={0} max={60}
                      onChange={v=>updatePlatformColor(p,'intensity',v/100)} pri={pri} sec={sec} />
                  </Group>
                )
              })}
            </div>
          )}

          {/* ── LIBRARY TAB ── */}
          {activeTab==='library' && (
            <div>
              <Group label="Cover Size" sec={sec}>
                <div style={{ display:'flex', gap:8 }}>
                  {CARD_SIZES.map(({value,label,desc}) => (
                    <button key={value} onClick={()=>setLocal(s=>({...s,cardSize:value}))} style={{
                      flex:1, padding:'10px 8px',
                      background: local.cardSize===value ? 'rgba(74,128,192,0.18)' : 'rgba(128,128,128,0.12)',
                      border: `1px solid ${local.cardSize===value ? '#4a80c055' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius:9, cursor:'pointer', transition:'all 0.15s', fontFamily:font }}>
                      <div style={{ fontSize:base, color:local.cardSize===value ? '#90b8f0' : pri, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:10, color:sec, marginTop:2, opacity:0.6 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </Group>

              <Group label="Score Badge Style" sec={sec}>
                <p style={{ fontSize:lbl, color:sec, marginBottom:12, lineHeight:1.6 }}>
                  How the OpenCritic score appears on each game card.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  {[
                    { value:'pill',   label:'Pill',          desc:'Score + tier label in top corner' },
                    { value:'review', label:'Review Badge',  desc:'Large circle overlapping the card bottom' },
                  ].map(({value,label,desc}) => (
                    <button key={value} onClick={()=>setLocal(s=>({...s,scoreBadgeStyle:value}))} style={{
                      flex:1, padding:'10px 8px',
                      background: (local.scoreBadgeStyle||'pill')===value ? 'rgba(74,128,192,0.18)' : 'rgba(128,128,128,0.12)',
                      border: `1px solid ${(local.scoreBadgeStyle||'pill')===value ? '#4a80c055' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius:9, cursor:'pointer', transition:'all 0.15s', fontFamily:font }}>
                      <div style={{ fontSize:base, color:(local.scoreBadgeStyle||'pill')===value ? '#90b8f0' : pri, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:10, color:sec, marginTop:2, opacity:0.6, lineHeight:1.4 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </Group>

              <Group label="Game Cards" sec={sec}>
                <Toggle label="Show install size on cards"
                  description="Displays a size badge (e.g. 48 GB) on each game card."
                  value={local.showSizeOnCards||false} onChange={v=>setLocal(s=>({...s,showSizeOnCards:v}))}
                  pri={pri} sec={sec} base={base} lbl={lbl} />
                <div style={{ marginTop:14 }}>
                  <Toggle label="Show hidden games"
                    description="Reveals games you've hidden. Open a hidden game's detail panel to unhide it."
                    value={local.showHiddenGames||false} onChange={v=>setLocal(s=>({...s,showHiddenGames:v}))}
                    pri={pri} sec={sec} base={base} lbl={lbl} />
                </div>
              </Group>

              <Group label="Cover Art & Scores" sec={sec}>
                <p style={{ fontSize:lbl, color:sec, marginBottom:10, lineHeight:1.6 }}>
                  Re-fetch all cover art and OpenCritic scores from scratch.
                </p>
                <ActionBtn onClick={()=>{ onReEnrich(); onClose() }} pri={pri}>↺ Re-fetch Cover Art & Scores</ActionBtn>
              </Group>
            </div>
          )}

          {/* ── ACCOUNT TAB ── */}
          {activeTab==='account' && (
            <div>
              <Group label="SteamGridDB API Key" sec={sec}>
                <p style={{ fontSize:lbl, color:sec, marginBottom:12, lineHeight:1.6 }}>
                  Used to fetch cover art for Epic, Ubisoft, EA, and GOG games.
                  Get a free key at <strong style={{color:'#4a90c0'}}>steamgriddb.com</strong> → Preferences → API.
                </p>
                <ActionBtn onClick={onReconfigure} pri={pri}>Update SteamGridDB Key</ActionBtn>
              </Group>
              <Group label="Diagnostics" sec={sec}>
                <p style={{ fontSize:lbl, color:sec, marginBottom:12, lineHeight:1.6 }}>
                  A debug log records every OpenCritic and SteamGridDB lookup.
                </p>
                <ActionBtn pri={pri} onClick={async () => {
                  const p = await window.peliVeli.getDebugLogPath()
                  navigator.clipboard?.writeText(p).catch(()=>{})
                  alert('Log path copied to clipboard:\n' + p)
                }}>📋 Copy Log File Path</ActionBtn>
              </Group>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding:'13px 22px', borderTop:'1px solid rgba(128,128,128,0.15)', display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'transparent',
            border:'1px solid rgba(128,128,128,0.2)', borderRadius:9, color:sec,
            fontSize:base, fontWeight:600, cursor:'pointer', fontFamily:font }}>Cancel</button>
          <button onClick={()=>{ onSave(local); onClose() }} style={{ flex:2, padding:'10px',
            background:'linear-gradient(135deg,#1e3a6e,#2e5fae)', border:'1px solid #2e5fae55',
            borderRadius:9, color:'#a0c0f0', fontSize:base, fontWeight:600, cursor:'pointer', fontFamily:font }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Group({ label, children, sec }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:10, color:sec, letterSpacing:'0.16em', textTransform:'uppercase',
        marginBottom:10, fontWeight:600, opacity:0.85 }}>{label}</div>
      {children}
    </div>
  )
}
function Slider({ label, value, min, max, onChange, pri, sec }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:12, color:sec }}>{label}</span>
        <span style={{ fontSize:12, color:pri, fontWeight:600 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(parseInt(e.target.value))}
        style={{ width:'100%', accentColor:'#4a80c0', cursor:'pointer' }} />
    </div>
  )
}
function ColorRow({ label, value, preview, previewColor, previewSize, font, sec, onChange }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:sec, marginBottom:6 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{ width:40, height:34, border:'none', borderRadius:6, cursor:'pointer', background:'none' }} />
        <div style={{ flex:1, padding:'8px 14px', background:'rgba(128,128,128,0.15)', borderRadius:8,
          fontSize:previewSize, color:previewColor, fontFamily:font }}>{preview}</div>
      </div>
    </div>
  )
}
function ActionBtn({ onClick, children, pri }) {
  return (
    <button onClick={onClick} style={{ width:'100%', padding:'10px', background:'rgba(128,128,128,0.15)',
      border:'1px solid rgba(128,128,128,0.2)', borderRadius:9, color:pri,
      fontSize:13, fontWeight:600, letterSpacing:'0.04em', cursor:'pointer', transition:'all 0.15s' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.22)'; e.currentTarget.style.background='rgba(128,128,128,0.25)' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; e.currentTarget.style.background='rgba(128,128,128,0.12)' }}
    >{children}</button>
  )
}
function Toggle({ label, description, value, onChange, pri, sec, base, lbl }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:4 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:base, color:pri, marginBottom:description?3:0 }}>{label}</div>
        {description && <div style={{ fontSize:lbl, color:sec, opacity:0.7, lineHeight:1.5 }}>{description}</div>}
      </div>
      <button onClick={()=>onChange(!value)} style={{ flexShrink:0, width:42, height:24, borderRadius:12,
        background:value?'#2e5fae':'#252838', border:`1px solid ${value?'#4a80c0':'rgba(255,255,255,0.12)'}`,
        position:'relative', cursor:'pointer', transition:'all 0.2s' }}>
        <span style={{ position:'absolute', top:3, left:value?20:3, width:16, height:16,
          borderRadius:'50%', background:value?'#c0d8f8':'#555a70', transition:'all 0.2s', display:'block' }} />
      </button>
    </div>
  )
}
