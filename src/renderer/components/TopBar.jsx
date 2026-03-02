import { useContext } from 'react'
import { SettingsContext } from '../App.jsx'

const SORT_OPTIONS = [
  { key: 'alpha',    label: 'A–Z'      },
  { key: 'platform', label: 'Platform' },
  { key: 'size',     label: 'Size'     },
  { key: 'score',    label: 'OC Score' },
]

export default function TopBar({ search, onSearch, sort, onSort, gameCount, totalCount }) {
  const s = useContext(SettingsContext)
  const textPrimary   = s?.fontColorPrimary   || '#d4d6e0'
  const textSecondary = s?.fontColorSecondary || '#7a7f9a'
  const font          = s?.fontFamily         || 'Segoe UI'
  const fontSize      = s?.fontSizeBase       || 13

  return (
    <div className="titlebar-drag" style={{
      padding: '0 20px',
      borderBottom: '1px solid rgba(255,255,255,0.09)',
      background: '#161820',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      height: 36,
    }}>
      {/* Search */}
      <div className="titlebar-no-drag" style={{ flex: 1, maxWidth: 280 }}>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search games..."
          style={{
            width: '100%',
            background: '#252838',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '5px 12px',
            color: textPrimary,
            fontSize: Math.max(fontSize - 1, 11),
            fontFamily: font,
          }}
        />
      </div>

      {/* Sort buttons */}
      <div className="titlebar-no-drag" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: textSecondary, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5, marginRight: 2 }}>Sort</span>
        {SORT_OPTIONS.map(({ key, label }) => {
          const active = sort.key === key
          const arrow  = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
          return (
            <button key={key} onClick={() => onSort(key)} style={{
              padding: '4px 11px',
              background: active ? 'rgba(74,128,192,0.22)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${active ? 'rgba(74,128,192,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 7,
              color: active ? '#a0c8f0' : textSecondary,
              fontSize: Math.max(fontSize - 2, 10),
              fontWeight: 600,
              fontFamily: font,
              transition: 'all 0.15s',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {label}{arrow}
            </button>
          )
        })}
      </div>

      {/* Count */}
      <span style={{ fontSize: 10, color: textSecondary, opacity: 0.5, marginLeft: 'auto', flexShrink: 0, letterSpacing: '0.06em' }}>
        {gameCount === totalCount ? `${totalCount} games` : `${gameCount} / ${totalCount}`}
      </span>
    </div>
  )
}
