import { useState, useEffect, useCallback } from 'react'
import { fetchParts, searchByPartNumber, isPartNumber, tokenize } from '../api'
import FilterPanel from './Filterpanel'
import { trackClick, sortByPopularity, statsCount } from '../popularity'
import { toggleFav, isFav, getAllFavs } from '../favorites'
import { setBuildPart, getBuild, getPickFilters, getFilterReason } from '../builder'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import type { ActiveFilters } from '../filters'

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
  // favorites mode
  favsMode?: boolean
  favParts?: { part: Part; category: Category }[]
  // builder picking mode
  pickingSlot?: Category
  onPicked?: () => void
}

const LIMIT = 40
const API_BASE = '/api/buildcores'

export default function Catalog({ category, onSelectPart, initialPage, initialSearch, onStateChange, tr, favsMode, favParts, pickingSlot, onPicked }: Props) {
  const [parts, setParts]           = useState<Part[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState(initialSearch)
  const [offset, setOffset]         = useState(initialPage)
  const [hasMore, setHasMore]       = useState(true)
  const [searchMode, setSearchMode] = useState<'name' | 'part' | 'fuzzy'>('name')
  const [filters, setFilters]       = useState<ActiveFilters>({})
  const [sort, setSort]             = useState<SortMode>('default')
  const [favs, setFavs]             = useState<Record<string, boolean>>({})
  const [builds, setBuilds]         = useState<Record<string, boolean>>({})
  const [popCount]                  = useState(() => statsCount())

  // keep fav state in sync
  function refreshFavs(list: Part[]) {
    const fm: Record<string, boolean> = {}
    const bm: Record<string, boolean> = {}
    const currentBuild = getBuild()
    list.forEach(p => {
      fm[p.opendb_id] = isFav(p.opendb_id)
      bm[p.opendb_id] = Object.values(currentBuild).some(e => e?.part.opendb_id === p.opendb_id)
    })
    setFavs(fm); setBuilds(bm)
  }

  const applySort = useCallback((data: Part[], mode: SortMode) =>
    mode === 'popular' ? sortByPopularity(data) : data, [])

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
      refreshFavs(sorted)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  }, [applySort])

  useEffect(() => {
    if (favsMode) {
      const data = (favParts ?? []).map(f => f.part)
      setParts(data); refreshFavs(data); setLoading(false)
      return
    }
    setSort('default')
    setParts([]); setOffset(0); setHasMore(true)
    // In picking mode — apply smart pre-filters, override manual filters
    const initFilters = isPicking ? getPickFilters(pickingSlot!, getBuild()) : {}
    setFilters(initFilters)
    smartLoad(category, initialPage > 0 ? initialSearch : '', 0, initFilters, 'default')
  }, [category, favsMode, pickingSlot])

  useEffect(() => {
    if (favsMode) return
    const timer = setTimeout(() => {
      setParts([]); setOffset(0)
      smartLoad(category, search, 0, filters, sort)
      onStateChange(0, search)
    }, 380)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (favsMode) return
    setParts([]); setOffset(0); smartLoad(category, search, 0, filters, sort)
  }, [filters])

  useEffect(() => {
    if (favsMode) return
    setParts(prev => applySort([...prev], sort))
  }, [sort, applySort])

  function loadMore() {
    const next = offset + LIMIT
    setOffset(next)
    smartLoad(category, search, next, filters, sort, true)
    onStateChange(next, search)
  }

  function handleBuildClick(e: React.MouseEvent, part: Part) {
    e.stopPropagation()
    if (builds[part.opendb_id]) return
    setBuildPart(category, part)
    setBuilds(prev => ({ ...prev, [part.opendb_id]: true }))
  }

  function handlePickForBuilder(part: Part) {
    setBuildPart(category, part)
    onPicked?.()
  }

  function handleFavClick(e: React.MouseEvent, part: Part) {
    e.stopPropagation()
    const nowFav = toggleFav(part, category)
    setFavs(prev => ({ ...prev, [part.opendb_id]: nowFav }))
    if (favsMode && !nowFav) {
      setParts(prev => prev.filter(p => p.opendb_id !== part.opendb_id))
    }
  }

  function handleCardClick(part: Part) {
    trackClick(part.opendb_id)
    onStateChange(offset, search)
    onSelectPart(part)
  }

  const catLabel = favsMode ? tr.favorites : tr[category]
  const isPicking = !!pickingSlot

  // Smart pre-filters for picking mode
  const pickFilters = isPicking ? getPickFilters(pickingSlot!, getBuild()) : {}
  const filterReason = isPicking ? getFilterReason(pickingSlot!, getBuild()) : null
  const displayParts = favsMode
    ? parts.filter(p => search ? p.name?.toLowerCase().includes(search.toLowerCase()) : true)
    : parts

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
                {!favsMode && searchMode !== 'name' && (
                  <span className={`search-mode-badge ${searchMode}`}>{searchMode === 'part' ? '#' : '~'}</span>
                )}
                <button className="search-clear" onClick={() => setSearch('')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </>
            )}
          </div>

          {!favsMode && (
            <>
              <button
                className={`sort-btn${sort === 'popular' ? ' active' : ''}`}
                onClick={() => setSort(s => s === 'popular' ? 'default' : 'popular')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3h18M3 9h12M3 15h7M3 21h4"/></svg>
                {sort === 'popular' ? 'Popular' : 'Sort'}
                {sort === 'popular' && popCount > 0 && <span className="sort-count">{popCount}</span>}
              </button>
              <FilterPanel category={category} filters={filters} onChange={setFilters} apiBase={API_BASE} />
            </>
          )}
        </div>
      </div>

      {isPicking && (
        <div className="picking-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          <div className="picking-banner-text">
            <span>Виберіть <strong>{catLabel}</strong> для PC Builder</span>
            {filterReason && <span className="picking-filter-badge">{filterReason}</span>}
          </div>
        </div>
      )}
      {error && (
        <div className="error-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {error}
        </div>
      )}

      {favsMode && displayParts.length === 0 && (
        <div className="empty-msg favs-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <p>{tr.noFavorites}</p>
        </div>
      )}

      <div className="parts-grid">
        {displayParts.map((part, idx) => {
          const score = sort === 'popular' ? (() => { try { const s = localStorage.getItem('partlist_pop'); return s ? (JSON.parse(s)[part.opendb_id]?.score ?? 0) : 0 } catch { return 0 } })() : 0
          const liked = favs[part.opendb_id] ?? false
          return (
            <button key={part.opendb_id} className={`part-card${sort === 'popular' && score > 0 ? ' has-score' : ''}${isPicking ? ' picking-mode' : ''}`} onClick={() => isPicking ? handlePickForBuilder(part) : handleCardClick(part)}>
              {sort === 'popular' && idx < 3 && score > 0 && <div className="pop-rank">#{idx + 1}</div>}
              <div className="part-card-cat">{favsMode ? (part as Part & {_catLabel?: string})._catLabel ?? category : catLabel}</div>
              <div className="part-card-name">{part.name || '—'}</div>
              <div className="part-card-mfr">{part.manufacturer}</div>
              <div className="part-card-sub">{partSubtitle(part, category)}</div>
              {sort === 'popular' && score > 0 && (
                <div className="pop-score-bar"><div className="pop-score-fill" style={{ width: `${Math.min(100, score)}%` }} /></div>
              )}
              <button
                className={`fav-btn${liked ? ' liked' : ''}`}
                onClick={e => handleFavClick(e, part)}
                title={liked ? tr.removeFromFavs : tr.addToFavs}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              {isPicking ? (
                <button
                  className="pick-select-btn"
                  onClick={e => { e.stopPropagation(); handlePickForBuilder(part) }}
                >
                  Select
                </button>
              ) : (
                <div className="part-card-arrow">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </div>
              )}
            </button>
          )
        })}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="part-card skeleton" />
        ))}
      </div>

      {!favsMode && !loading && hasMore && parts.length > 0 && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={loadMore}>{tr.loadMore}</button>
        </div>
      )}
      {!favsMode && !loading && parts.length === 0 && !error && (
        <div className="empty-msg">{tr.noResults}</div>
      )}
    </div>
  )
}