import { useState, useEffect, useCallback } from 'react'
import { fetchParts, searchByPartNumber, isPartNumber, tokenize } from '../api'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import { CategoryIcon } from './Icons'

const CAT_IDS: Category[] = ['cpu','gpu','motherboard','ram','psu','storage']

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

export default function Catalog({ category, onSelectPart, initialPage, initialSearch, onStateChange, tr }: Props) {
  const [parts, setParts]         = useState<Part[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState(initialSearch)
  const [offset, setOffset]       = useState(initialPage)
  const [hasMore, setHasMore]     = useState(true)
  const [searchMode, setSearchMode] = useState<'name' | 'part' | 'fuzzy'>('name')

  // Smart search: decides strategy based on query shape
  const smartLoad = useCallback(async (cat: Category, q: string, off: number, append = false) => {
    setLoading(true); setError(null)
    try {
      let data: Part[] = []

      if (!q.trim()) {
        // Empty — load all
        data = await fetchParts(cat, { limit: LIMIT, offset: off })
        setSearchMode('name')
        setHasMore(data.length === LIMIT)

      } else if (isPartNumber(q)) {
        // Looks like a part number — search /part/ endpoint across all tables
        // then filter by current category
        setSearchMode('part')
        const allResults = await searchByPartNumber(q.trim())
        data = allResults.filter(p => {
          // The /part/ endpoint returns _table field
          const tableMap: Record<string, Category> = {
            cpu: 'cpu', gpu: 'gpu', motherboard: 'motherboard',
            ram: 'ram', psu: 'psu', storage: 'storage',
          }
          const partCat = (p as Part & { _table?: string })._table
          return !partCat || tableMap[partCat] === cat
        })
        // If nothing in current category, show all
        if (data.length === 0) data = allResults
        setHasMore(false)

      } else {
        // Regular text — try full query first, then tokenized fallback
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
    if (initialPage > 0 || initialSearch) {
      smartLoad(category, initialSearch, 0)
    } else {
      setParts([]); setOffset(0); setHasMore(true)
      smartLoad(category, '', 0)
    }
  }, [category])

  useEffect(() => {
    const timer = setTimeout(() => {
      setParts([]); setOffset(0)
      smartLoad(category, search, 0)
      onStateChange(0, search)
    }, 380)
    return () => clearTimeout(timer)
  }, [search])

  function loadMore() {
    const next = offset + LIMIT
    setOffset(next)
    smartLoad(category, search, next, true)
    onStateChange(next, search)
  }

  const catLabel = tr[category]
  void CAT_IDS

  return (
    <div className="catalog">
      <div className="catalog-topbar">
        <h2 className="catalog-heading">
          {catLabel}
        </h2>
        <div className="search-bar">
          <span className="search-icon">⌕</span>
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
              <button className="search-clear" onClick={() => setSearch('')}>✕</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-msg">⚠ {error}</div>}

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
            <div className="part-card-arrow">→</div>
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