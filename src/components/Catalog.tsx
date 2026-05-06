import { useState, useEffect, useCallback } from 'react'
import { fetchParts, searchByPartNumber, isPartNumber, tokenize } from '../api'
import FilterPanel from './Filterpanel'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import type { ActiveFilters } from '../Filters.ts'

function partSubtitle(part: Part, cat: Category): string {
  switch (cat) {
    case 'cpu':         return [part.socket, part.total_cores && `${part.total_cores}C`, part.tdp_w && `${part.tdp_w}W`].filter(Boolean).join(' · ')
    case 'gpu':         return [part.chipset, part.memory_gb && `${part.memory_gb}GB`, part.memory_type].filter(Boolean).join(' · ')
    case 'motherboard': return [part.socket, part.form_factor, part.ram_type].filter(Boolean).join(' · ')
    case 'ram':         return [part.ram_type, part.total_capacity_gb && `${part.total_capacity_gb}GB`, part.speed_mhz && `${part.speed_mhz}MHz`].filter(Boolean).join(' · ')
    case 'psu':         return [part.wattage && `${part.wattage}W`, part.efficiency_rating, part.modular].filter(Boolean).join(' · ')
    case 'storage':     return [part.storage_type, part.capacity_gb && `${part.capacity_gb}GB`, part.interface].filter(Boolean).join(' · ')
    default:            return ''
  }
}

interface Props {
  category: Category
  onCategoryChange: (c: Category) => void
  onSelectPart: (p: Part) => void
  initialPage: number
  initialSearch: string
  onStateChange: (page: number, search: string) => void
  tr: Translations
}

const LIMIT = 40
const API_BASE = '/api/buildcores'

export default function Catalog({ category, onSelectPart, initialPage, initialSearch, onStateChange, tr }: Props) {
  const [parts, setParts]       = useState<Part[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState(initialSearch)
  const [offset, setOffset]     = useState(initialPage)
  const [hasMore, setHasMore]   = useState(true)
  const [searchMode, setSearchMode] = useState<'name' | 'part' | 'fuzzy'>('name')
  const [filters, setFilters]   = useState<ActiveFilters>({})

  const smartLoad = useCallback(async (
    cat: Category, q: string, off: number, activeFilters: ActiveFilters, append = false
  ) => {
    setLoading(true); setError(null)
    try {
      let data: Part[] = []

      if (!q.trim() || Object.keys(activeFilters).length > 0) {
        // Normal load with optional filters
        const params: Record<string, string | number> = { limit: LIMIT, offset: off, ...activeFilters }
        if (q.trim() && !isPartNumber(q)) params.name = q.trim()
        data = await fetchParts(cat, params)
        setSearchMode('name')
        setHasMore(data.length === LIMIT)
      } else if (isPartNumber(q)) {
        setSearchMode('part')
        const all = await searchByPartNumber(q.trim())
        data = all.filter(p => {
          const tableMap: Record<string, Category> = { cpu:'cpu', gpu:'gpu', motherboard:'motherboard', ram:'ram', psu:'psu', storage:'storage' }
          const partCat = (p as Part & { _table?: string })._table
          return !partCat || tableMap[partCat] === cat
        })
        if (data.length === 0) data = all
        setHasMore(false)
      } else {
        setSearchMode('fuzzy')
        const tokens = tokenize(q)
        for (const token of tokens) {
          data = await fetchParts(cat, { limit: LIMIT, offset: off, name: token })
          if (data.length > 0) break
        }
        setHasMore(data.length === LIMIT)
      }

      setParts(prev => append ? [...prev, ...data] : data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    setFilters({})
    setParts([]); setOffset(0); setHasMore(true)
    if (initialPage > 0 || initialSearch) {
      smartLoad(category, initialSearch, 0, {})
    } else {
      smartLoad(category, '', 0, {})
    }
  }, [category])

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setParts([]); setOffset(0)
      smartLoad(category, search, 0, filters)
      onStateChange(0, search)
    }, 380)
    return () => clearTimeout(timer)
  }, [search])

  // Filters change
  useEffect(() => {
    setParts([]); setOffset(0)
    smartLoad(category, search, 0, filters)
  }, [filters])

  function loadMore() {
    const next = offset + LIMIT
    setOffset(next)
    smartLoad(category, search, next, filters, true)
    onStateChange(next, search)
  }

  const catLabel = tr[category]

  return (
    <div className="catalog">
      <div className="catalog-topbar">
        <h2 className="catalog-heading">{catLabel}</h2>

        <div className="catalog-controls">
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              className="search-input"
              placeholder={tr.searchPlaceholder(catLabel)}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <>
                {searchMode !== 'name' && (
                  <span className={`search-mode-badge ${searchMode}`}>
                    {searchMode === 'part' ? '#' : '~'}
                  </span>
                )}
                <button className="search-clear" onClick={() => setSearch('')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </>
            )}
          </div>

          <FilterPanel
            category={category}
            filters={filters}
            onChange={setFilters}
            apiBase={API_BASE}
          />
        </div>
      </div>

      {error && (
        <div className="error-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {error}
        </div>
      )}

      <div className="parts-grid">
        {parts.map(part => (
          <button
            key={part.opendb_id}
            className="part-card"
            onClick={() => { onStateChange(offset, search); onSelectPart(part) }}
          >
            <div className="part-card-cat">{catLabel}</div>
            <div className="part-card-name">{part.name || '—'}</div>
            <div className="part-card-mfr">{part.manufacturer}</div>
            <div className="part-card-sub">{partSubtitle(part, category)}</div>
            <div className="part-card-arrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </div>
          </button>
        ))}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="part-card skeleton" />
        ))}
      </div>

      {!loading && hasMore && parts.length > 0 && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={loadMore}>{tr.loadMore}</button>
        </div>
      )}
      {!loading && parts.length === 0 && !error && (
        <div className="empty-msg">{tr.noResults}</div>
      )}
    </div>
  )
}