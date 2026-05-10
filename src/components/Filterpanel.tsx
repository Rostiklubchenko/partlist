import { useState, useEffect } from 'react'
import type { Category } from '../types/index.ts'
import { FILTER_CONFIGS, FIXED_OPTIONS, fetchFilterOptions, type ActiveFilters } from '../filters.ts'

interface Props {
  category: Category
  filters: ActiveFilters
  onChange: (filters: ActiveFilters) => void
  apiBase: string
}

export default function FilterPanel({ category, filters, onChange, apiBase }: Props) {
  const [options, setOptions] = useState<Record<string, string[]>>({})
  const [open, setOpen] = useState(false)

  const config = FILTER_CONFIGS[category]
  const activeCount = Object.keys(filters).length

  // Load select options when category changes
  useEffect(() => {
    setOptions({})
    const selectFields = config.filter(f => f.type === 'select' && !FIXED_OPTIONS[f.key])
    Promise.all(
      selectFields.map(async f => {
        const vals = await fetchFilterOptions(category, f.key, apiBase)
        return [f.key, vals] as [string, string[]]
      })
    ).then(results => {
      setOptions(Object.fromEntries(results))
    })
  }, [category])

  function set(key: string, value: string | number | '') {
    const next = { ...filters }
    if (value === '' || value === undefined) delete next[key]
    else next[key] = value
    onChange(next)
  }

  function reset() { onChange({}) }

  return (
    <div className="filter-wrap">
      <button
        className={`filter-toggle${activeCount > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filters
        {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        <svg className={`filter-chevron${open ? ' rotated' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="filter-panel">
          <div className="filter-panel-header">
            <span className="filter-panel-title">Filters</span>
            {activeCount > 0 && (
              <button className="filter-reset" onClick={reset}>Clear all</button>
            )}
          </div>

          <div className="filter-fields">
            {config.map(field => (
              <div key={field.key} className="filter-field">
                <label className="filter-label">{field.label}</label>

                {field.type === 'select' && (
                  <select
                    className="filter-select"
                    value={String(filters[field.key] ?? '')}
                    onChange={e => set(field.key, e.target.value)}
                  >
                    <option value="">— Any —</option>
                    {FIXED_OPTIONS[field.key]
                      ? FIXED_OPTIONS[field.key].map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))
                      : (options[field.key] ?? []).map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))
                    }
                  </select>
                )}

                {field.type === 'range' && (
                  <div className="filter-range">
                    <input
                      type="range"
                      className="filter-slider"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={Number(filters[field.key] ?? field.min)}
                      onChange={e => set(field.key, Number(e.target.value))}
                    />
                    <div className="filter-range-vals">
                      <span className="filter-range-min">{field.min}{field.unit}</span>
                      <span className="filter-range-cur">
                        {filters[field.key] != null
                          ? `${filters[field.key]}${field.unit}`
                          : <span className="filter-range-any">any</span>
                        }
                      </span>
                      <span className="filter-range-max">{field.max}{field.unit}</span>
                    </div>
                    {filters[field.key] != null && (
                      <button className="filter-range-clear" onClick={() => set(field.key, '')}>
                        clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}