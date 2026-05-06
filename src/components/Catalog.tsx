import { useState, useEffect, useCallback } from 'react'
import { fetchParts, searchByPartNumber, isPartNumber, tokenize } from '../api'
import FilterPanel from './Filterpanel'
import { trackClick, sortByPopularity, statsCount } from '../popularity'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import type { ActiveFilters } from '../Filters'

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

type SortMode = 'default' | 'popular'

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
  const [sort, setSort]         = useState<SortMode>('default')
  const [popCount]              = useState(() => statsCount())

  const applySort = useCallback((data: Part[], mode: SortMode) =>
    mode === 'popular' ? sortByPopularity(data) : data
  , [])

  const smartLoad = useCallback(async (
    cat: Category, q: string, off: number, activeFilters: ActiveFilters,
    sortMode: SortMode, append = false
  ) => {
    setLoading(true); setError(null)
    try {
      let data: Part[] = []

      if (!q.trim() || Object.keys(activeFilters).length > 0) {
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

      const sorted = applySort(data, sortMode)
      setParts(prev => append ? [...prev, ...sorted] : sorted)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  }, [applySort])

  useEffect(() => {
    setFilters({}); setSort('default')
    setParts([]); setOffset(0); setHasMore(true)
    smartLoad(category, initialPage > 0 ? initialSearch : '', 0, {}, 'default')
  }, [category])

  useEffect(() => {
    const timer = setTimeout(() => {
      setParts([]); setOffset(0)
      smartLoad(category, search, 0, filters, sort)
      onStateChange(0, search)
    }, 380)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setParts([]); setOffset(0)
    smartLoad(category, search, 0, filters, sort)
  }, [filters])

  // Re-sort in place when sort mode changes (no API call needed)
  useEffect(() => {
    setParts(prev => applySort([...prev], sort))
  }, [sort, applySort])

  function loadMore() {
    const next = offset + LIMIT
    setOffset(next)
    smartLoad(category, search, next, filters, sort, true)
    onStateChange(next, search)
  }

  function handleCardClick(part: Part) {
    trackClick(part.opendb_id)
    onStateChange(offset, search)
    onSelectPart(part)
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

          {/* Sort toggle */}
          <button
            className={`sort-btn${sort === 'popular' ? ' active' : ''}`}
            onClick={() => setSort(s => s === 'popular' ? 'default' : 'popular')}
            title={sort === 'popular' ? 'Sorted by popularity' : 'Sort by popularity'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3h18M3 9h12M3 15h7M3 21h4"/></svg>
            {sort === 'popular' ? 'Popular' : 'Sort'}
            {sort === 'popular' && popCount > 0 && (
              <span className="sort-count">{popCount}</span>
            )}
          </button>

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
        {parts.map((part, idx) => {
          const score = sort === 'popular' ? (
            // import lazily to avoid re-importing module
            (() => { try { const s = localStorage.getItem('partlist_pop'); return s ? (JSON.parse(s)[part.opendb_id]?.score ?? 0) : 0 } catch { return 0 } })()
          ) : 0
          return (
            <button
              key={part.opendb_id}
              className={`part-card${sort === 'popular' && score > 0 ? ' has-score' : ''}`}
              onClick={() => handleCardClick(part)}
            >
              {sort === 'popular' && idx < 3 && score > 0 && (
                <div className="pop-rank">#{idx + 1}</div>
              )}
              <div className="part-card-cat">{catLabel}</div>
              <div className="part-card-name">{part.name || '—'}</div>
              <div className="part-card-mfr">{part.manufacturer}</div>
              <div className="part-card-sub">{partSubtitle(part, category)}</div>
              {sort === 'popular' && score > 0 && (
                <div className="pop-score-bar">
                  <div className="pop-score-fill" style={{ width: `${Math.min(100, score)}%` }} />
                </div>
              )}
              <div className="part-card-arrow">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </div>
            </button>
          )
        })}
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