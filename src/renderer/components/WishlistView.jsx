import { useState, useEffect, useRef, useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const CURRENCY_SYMBOLS = {
  eur:'€', usd:'$', gbp:'£', cad:'C$', aud:'A$',
  nok:'kr', sek:'kr', dkk:'kr', pln:'zł', brl:'R$', rub:'₽', try:'₺',
}

function isLight(hex) {
  try {
    const c = (hex||'').replace('#','')
    if (c.length<6) return false
    const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16)
    return (r*299+g*587+b*114)/1000>160
  } catch(_){return false}
}

// ── Add Modal ────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose, pri, sec, inputBg, inputBdr, panelBg, borderColor, font, base, lbl }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError]         = useState('')
  const debounceRef               = useRef(null)
  const inputRef                  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setError('')
      try {
        const found = await window.peliVeli.findWishlistGames(query.trim())
        setResults(found || [])
        if (!found?.length) setError('No games found — try a different spelling')
      } catch (e) {
        setError('Search failed — check your connection')
      } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.6)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:460, background:panelBg, borderRadius:14,
          border:`1px solid ${borderColor}`,
          boxShadow:'0 24px 64px rgba(0,0,0,0.7)',
          padding:24, fontFamily:font,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <h3 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:22, color:pri,
              letterSpacing:'0.08em', margin:0 }}>★ ADD TO WISHLIST</h3>
            <button onClick={onClose} style={{
  background:inputBg, border:`1px solid ${inputBdr}`,
              borderRadius:'50%', width:28, height:28, cursor:'pointer',
              color:sec, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          </div>

          {/* Search input */}
          <div style={{ position:'relative', marginBottom:12 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search for a game..."
              style={{
                width:'100%', boxSizing:'border-box',
                background:inputBg, border:`1px solid ${inputBdr}`,
                borderRadius:9, padding:'10px 14px', color:pri,
                fontSize:base, fontFamily:font, outline:'none',
              }}
            />
            {searching && (
              <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                fontSize:11, color:sec, opacity:0.6 }}>Searching…</span>
            )}
          </div>

          {/* Results list */}
          {results.length > 0 && (
            <div style={{
  border:`1px solid ${inputBdr}`, borderRadius:9,
              overflow:'hidden', maxHeight:280, overflowY:'auto',
            }}>
              {results.map((r, i) => (
                <div key={r.id} onClick={() => { onAdd(r); onClose() }} style={{
                  padding:'11px 14px', cursor:'pointer', fontSize:base, color:pri,
  borderBottom: i < results.length-1 ? `1px solid ${inputBdr}` : 'none',
                  background:'transparent', transition:'background 0.12s',
                  display:'flex', alignItems:'center', gap:10,
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(232,160,32,0.1)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <span style={{ color:'#e8a020', opacity:0.7, fontSize:12 }}>★</span>
                  <span style={{ color:pri }}>{r.name}</span>
                </div>
              ))}
            </div>
          )}

          {error && !searching && (
            <div style={{ fontSize:lbl, color:'#e05050', marginTop:8, textAlign:'center', opacity:0.8 }}>{error}</div>
          )}

          {!results.length && !searching && !error && query.trim().length >= 2 && (
            <div style={{ fontSize:lbl, color:sec, marginTop:8, textAlign:'center', opacity:0.5 }}>
              Type to search AllKeyShop…
            </div>
          )}

          {query.trim().length < 2 && (
            <div style={{ fontSize:lbl, color:sec, marginTop:8, textAlign:'center', opacity:0.4 }}>
              Start typing a game name to search
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Price Panel ──────────────────────────────────────────────────────────────
function PricePanel({ item, country, onClose, pri, sec, font, base, lbl, panelBg, inputBdr }) {
  const [loading, setLoading]   = useState(true)
  const [prices, setPrices]     = useState(null)
  const [error, setError]       = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setPrices(null)
    window.peliVeli.fetchWishlistPrices(item.itadId || item.id, country)
      .then(data => {
        if (cancelled) return
        if (data.error && !data.offers?.length) {
          setError(data.error || 'No prices found')
        } else {
          setPrices(data)
        }
      })
      .catch(e => { if (!cancelled) setError('Failed to fetch prices') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [item.id, country])

  function PriceRow({ offer }) {
    // Derive currency symbol from the offer's currency code
    const sym = CURRENCY_SYMBOLS[offer.currency?.toLowerCase()] || offer.currency || ''
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
        borderRadius:8, background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.06)', marginBottom:6,
        cursor: offer.url ? 'pointer' : 'default', transition:'background 0.12s',
      }}
        onClick={() => offer.url && window.peliVeli.openExternal(offer.url)}
        onMouseEnter={e=>{ if(offer.url) e.currentTarget.style.background='rgba(255,255,255,0.07)' }}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
      >
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:base, color:pri, fontWeight:600, whiteSpace:'nowrap',
            overflow:'hidden', textOverflow:'ellipsis' }}>{offer.store}</div>
          {offer.drm && (
            <div style={{ fontSize:lbl-1, color:sec, opacity:0.5 }}>{offer.drm}</div>
          )}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:base+2, color:'#50c878', fontWeight:700 }}>
            {sym}{offer.price.toFixed(2)}
          </div>
          {offer.cut > 0 && (
            <div style={{ fontSize:lbl-1, color:'#e8a020', opacity:0.8 }}>
              -{offer.cut}%
            </div>
          )}
        </div>
        {offer.url && (
          <span style={{ fontSize:11, color:sec, opacity:0.4, flexShrink:0 }}>↗</span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position:'fixed', top:136, right:0, bottom:0, width:360,
      background:panelBg, borderLeft:`1px solid ${inputBdr}`,
      borderTopLeftRadius:14, zIndex:100,
      display:'flex', flexDirection:'column',
      boxShadow:'-16px 0 48px rgba(0,0,0,0.5)',
      animation:'slideInPanel 0.22s ease', fontFamily:font, color:pri,
    }}>
      <style>{`@keyframes slideInPanel{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`}</style>

      {/* Header */}
      <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, color:'#e8a020', letterSpacing:'0.18em',
              textTransform:'uppercase', marginBottom:4, opacity:0.8 }}>Wishlist Prices</div>
            <h3 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:22, color:pri,
              letterSpacing:'0.05em', margin:0, lineHeight:1.2,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</h3>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:'50%', width:28, height:28, cursor:'pointer',
            color:'#fff', fontSize:16, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 24px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0', color:sec, fontSize:lbl }}>
            Fetching prices…
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#e05050', fontSize:lbl, lineHeight:1.6 }}>
            {error}
          </div>
        )}
        {prices && !loading && (
          <>
            {prices.offers?.length > 0
              ? prices.offers.map((o, i) => <PriceRow key={i} offer={o} />)
              : (
                <div style={{ textAlign:'center', padding:'30px 20px', color:sec,
                  fontSize:lbl, lineHeight:1.6, opacity:0.7 }}>
                  No prices found for this game
                </div>
              )
            }
            <div style={{ fontSize:lbl-1, color:sec, opacity:0.4, textAlign:'center',
              marginTop:14, lineHeight:1.5 }}>
              via IsThereAnyDeal · click any row to open store
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main WishlistView ────────────────────────────────────────────────────────
export default function WishlistView({ wishlist, onAdd, onRemove, country }) {
  const [showAddModal, setShowAddModal]     = useState(false)
  const [selectedItem, setSelectedItem]     = useState(null)
  const s = useContext(SettingsContext)

  const font    = s.fontFamily || 'Calibri'
  const base    = s.fontSizeBase || 13
  const lbl     = s.fontSizeLabel || 11
  const appBg   = s.appBackground || '#0c0e16'
  const lightBg = isLight(appBg)
  const panelBg    = lightBg ? (s.appBackground || '#f0ede6') : (s.drawerBackground || '#161820')
  const borderColor = lightBg ? 'rgba(0,0,0,0.12)' : (s.borderColor || 'rgba(255,255,255,0.06)')
  const pri     = lightBg ? '#1a1a14' : (s.fontColorPrimary || '#d4d6e0')
  const sec     = lightBg ? '#5a5a4a' : (s.fontColorSecondary || '#a0a8b8')
  const inputBg = lightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'
  const inputBdr= lightBg ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.10)'
  const sharedProps = { pri, sec, font, base, lbl, inputBg, inputBdr, panelBg, borderColor }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
      background:appBg, fontFamily:font }}>

      {/* Wishlist toolbar */}
      <div style={{ padding:'16px 24px 14px', borderBottom:`1px solid ${s.borderColor||'rgba(255,255,255,0.06)'}`,
        display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:20, color:pri,
          letterSpacing:'0.08em', opacity:0.9 }}>★ WISHLIST</span>
        {wishlist.length > 0 && (
          <span style={{ fontSize:lbl, color:sec, opacity:0.6 }}>
            {wishlist.length} {wishlist.length === 1 ? 'game' : 'games'}
          </span>
        )}
        <div style={{ flex:1 }} />
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding:'7px 16px',
            background:'rgba(232,160,32,0.12)',
            border:'1px solid rgba(232,160,32,0.35)',
            borderRadius:8, cursor:'pointer',
            color:'#e8a020',
            fontFamily:"'Bebas Neue',cursive", fontSize:15, letterSpacing:'0.1em',
            transition:'all 0.2s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(232,160,32,0.22)'; e.currentTarget.style.borderColor='rgba(232,160,32,0.6)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(232,160,32,0.12)'; e.currentTarget.style.borderColor='rgba(232,160,32,0.35)' }}
        >
          + ADD TO WISHLIST
        </button>
      </div>

      {/* Grid area */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {wishlist.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:'100%', gap:14, opacity:0.5 }}>
            <span style={{ fontSize:48, opacity:0.3 }}>★</span>
            <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:20, color:sec,
              letterSpacing:'0.1em' }}>YOUR WISHLIST IS EMPTY</span>
            <span style={{ fontSize:lbl, color:sec }}>
              Click "Add to Wishlist" to start tracking games
            </span>
          </div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignContent:'flex-start' }}>
            {wishlist.map(item => {
              const isSelected = selectedItem?.id === item.id
              const W = 152, H = 228
              return (
                <div key={item.id} style={{
                  width:W, flexShrink:0, cursor:'pointer', borderRadius:10,
                  overflow:'visible', position:'relative',
                  border:`1px solid ${isSelected ? 'rgba(232,160,32,0.6)' : (lightBg ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.07)')}`,
                  background: isSelected ? 'rgba(232,160,32,0.08)' : lightBg ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                  boxShadow: isSelected ? '0 0 0 2px rgba(232,160,32,0.2), 0 8px 24px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.35)',
                  transition:'all 0.18s',
                }}
                  onClick={() => setSelectedItem(isSelected ? null : item)}
                  onMouseEnter={e=>{ if(!isSelected){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.5)' }}}
                  onMouseLeave={e=>{ if(!isSelected){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.35)' }}}
                >
                  {/* Cover art area */}
                  <div style={{ position:'relative', width:W, height:H, background:appBg, overflow:'hidden', borderRadius:'9px 9px 0 0' }}>
                    {item.coverArt
                      ? <img
                          src={`peliveli://covers/${encodeURIComponent(item.coverArt.split(/[\\/]/).pop())}`}
                          alt={item.name}
                          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                          onError={e=>{ e.target.style.display='none' }}
                        />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:32, opacity:0.1 }}>★</span>
                        </div>
                    }
                    {/* OC badge */}
                    {item.ocTier && (
                      <div style={{
                        position:'absolute', top:7, right:7, zIndex:2,
                        padding:'4px 8px', borderRadius:20,
                        background: item.ocTier==='Mighty'?'#00c896':item.ocTier==='Strong'?'#4a90e2':item.ocTier==='Fair'?'#f0a020':'#e05050',
                        display:'flex', alignItems:'center', gap:5,
                        boxShadow:'0 2px 8px rgba(0,0,0,0.55)',
                      }}>
                        <span style={{ fontSize:12, fontWeight:900, color:'#fff', lineHeight:1 }}>{item.ocScore??'?'}</span>
                        <span style={{ width:1, height:11, background:'rgba(255,255,255,0.4)', display:'inline-block' }} />
                        <span style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.88)', letterSpacing:'0.07em', textTransform:'uppercase' }}>{item.ocTier}</span>
                      </div>
                    )}
                    {/* Wishlist star */}
                    <div style={{
                      position:'absolute', top:7, left:7, zIndex:2,
                      background:'rgba(232,160,32,0.9)', borderRadius:12,
                      padding:'2px 7px', fontSize:10, color:'#fff', fontWeight:700,
                    }}>★</div>
                    {/* Gradient overlay */}
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:50,
                      background:`linear-gradient(transparent, ${appBg})` }} />
                  </div>

                  {/* Title */}
                  <div style={{ padding:'6px 9px 4px' }}>
                    <div style={{ fontSize:lbl, fontWeight:600, color:pri, lineHeight:1.25, fontFamily:font,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {item.name}
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display:'flex', borderTop:`1px solid ${isSelected?'rgba(232,160,32,0.2)':(lightBg?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)')}` }}>
                    <button
                      onClick={e=>{ e.stopPropagation(); setSelectedItem(isSelected?null:item) }}
                      style={{
                        flex:1, padding:'8px 0', background:'transparent', border:'none',
                        borderRight:`1px solid ${isSelected?'rgba(232,160,32,0.2)':(lightBg?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)')}`,
                        color:isSelected?'#e8a020':sec, fontSize:lbl-1, cursor:'pointer',
                        fontFamily:font, letterSpacing:'0.04em', transition:'color 0.15s',
                      }}
                    >
                      {isSelected ? '✕ Close' : '$ Prices'}
                    </button>
                    <button
                      onClick={e=>{ e.stopPropagation(); if(selectedItem?.id===item.id)setSelectedItem(null); onRemove(item.id) }}
                      style={{
                        flex:1, padding:'8px 0', background:'transparent', border:'none',
                        color:sec, fontSize:lbl-1, cursor:'pointer', fontFamily:font,
                        letterSpacing:'0.04em', transition:'color 0.15s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.color='#e05050'}
                      onMouseLeave={e=>e.currentTarget.style.color=sec}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Price panel */}
      {selectedItem && (
        <>
          <div onClick={() => setSelectedItem(null)}
            style={{ position:'fixed', inset:0, zIndex:99 }} />
          <PricePanel
            item={selectedItem}
            country={country}
            onClose={() => setSelectedItem(null)}
            {...sharedProps}
          />
        </>
      )}

      {/* Add modal */}
      {showAddModal && (
        <AddModal
          onAdd={item => { onAdd(item); setShowAddModal(false) }}
          onClose={() => setShowAddModal(false)}
          {...sharedProps}
        />
      )}
    </div>
  )
}
