import { useState, useMemo } from 'react'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import { CategoryIcon } from './Icons'

interface CompareEntry { part: Part; category: Category }
interface Props {
  entries: CompareEntry[]
  onRemove: (id: string) => void
  onClear: () => void
  onViewPart: (part: Part, cat: Category) => void
  tr: Translations
}

function fv(val: unknown): string {
  if (val == null || val === '' || val === undefined) return '—'
  const s = String(val)
  if (s === '0' || s === '1') return s === '1' ? '✓' : '✗'
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) {
        const parts = arr.map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            const o = item as Record<string, string>
            return [o.size, o.interface].filter(Boolean).join(' ')
          }
          return String(item)
        })
        const uniq = [...new Set(parts)]
        if (uniq.length === 1) return `${uniq[0]} ×${arr.length}`
        return uniq.join(', ')
      }
    } catch { /* noop */ }
  }
  return s
}

// Get all spec keys for a set of parts (from _specs), union of all keys
function getSpecKeys(parts: Part[]): string[] {
  const keySet = new Set<string>()
  for (const p of parts) {
    const specs = (p as any)._specs as Record<string, string> | undefined
    if (specs) Object.keys(specs).forEach(k => keySet.add(k))
  }
  return [...keySet]
}

function getSpecValue(part: Part, key: string): string {
  const specs = (part as any)._specs as Record<string, string> | undefined
  return fv(specs?.[key])
}

export default function Compare({ entries, onRemove, onClear, onViewPart, tr }: Props) {
  const categories = useMemo(() => [...new Set(entries.map(e => e.category))] as Category[], [entries])
  const [activeTab, setActiveTab] = useState<Category>(() => categories[0] ?? 'cpu')
  const [diffOnly, setDiffOnly] = useState(false)

  // Keep activeTab valid when entries change
  const currentCat = categories.includes(activeTab) ? activeTab : (categories[0] ?? 'cpu')
  const tabEntries = entries.filter(e => e.category === currentCat)
  const tabParts = tabEntries.map(e => e.part)

  // Build spec rows from _specs
  const allKeys = useMemo(() => getSpecKeys(tabParts), [tabEntries])

  const rows = useMemo(() => {
    return allKeys
      .map(key => ({
        key,
        vals: tabParts.map(p => getSpecValue(p, key)),
      }))
      .filter(r => r.vals.some(v => v !== '—'))
  }, [allKeys, tabEntries])

  const visibleRows = diffOnly
    ? rows.filter(r => new Set(r.vals).size > 1)
    : rows

  if (entries.length === 0) {
    return (
      <div className="compare-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
        <p>{tr.compareEmpty}</p>
        <span className="compare-hint">{tr.compareOneCat}</span>
      </div>
    )
  }

  return (
    <div className="compare">
      <div className="compare-header">
        <h2 className="compare-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
          {tr.compareTitle}
        </h2>
        <div className="compare-controls">
          <button className={`compare-diff-btn${diffOnly ? ' active' : ''}`} onClick={() => setDiffOnly(d => !d)}>
            {tr.compareDiff}
          </button>
          <button className="compare-clear-btn" onClick={onClear}>{tr.compareClear}</button>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="compare-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`compare-tab${currentCat === cat ? ' active' : ''}`}
              onClick={() => setActiveTab(cat)}
            >
              <CategoryIcon id={cat} size={13} />
              {tr[cat]}
              <span className="compare-tab-count">{entries.filter(e => e.category === cat).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-th-label"></th>
              {tabEntries.map(e => (
                <th key={e.part.opendb_id} className="compare-th-part">
                  <div className="compare-part-head">
                    {(e.part as any)._image_url && (
                      <img src={(e.part as any)._image_url} alt="" className="compare-part-img" />
                    )}
                    <button className="compare-part-name" onClick={() => onViewPart(e.part, e.category)}>
                      {e.part.name}
                    </button>
                    <span className="compare-part-mfr">{e.part.manufacturer}</span>
                    {(e.part as any)._price_uah && (
                      <span className="compare-part-price">
                        {((e.part as any)._price_uah as number).toLocaleString('uk-UA')} ₴
                      </span>
                    )}
                    <button className="compare-remove-btn" onClick={() => onRemove(e.part.opendb_id)} title={tr.compareRemove}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td className="compare-td-label" colSpan={tabEntries.length + 1} style={{textAlign:'center', padding:'24px', color:'var(--text3)'}}>
                  {(tabParts.some(p => (p as any)._specs && Object.keys((p as any)._specs).length > 0))
                    ? diffOnly ? tr.compareDiff + ' — ' + tr.compareEmpty : tr.compareEmpty
                    : 'Характеристики ще завантажуються...'}
                </td>
              </tr>
            )}
            {visibleRows.map(({ key, vals }) => {
              const isDiff = new Set(vals).size > 1
              return (
                <tr key={key} className={isDiff ? 'compare-row-diff' : ''}>
                  <td className="compare-td-label">{key}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`compare-td-val${isDiff ? ' diff' : ''}`}>{v}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {categories.length > 1 && (
        <p className="compare-mixed-note">{tr.compareOneCat}</p>
      )}
    </div>
  )
}