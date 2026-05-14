import { useState, useEffect } from 'react'
import type { Part, Category, RozetkaResult, ShopsResult, ShopEntry } from '../types'
import type { Translations } from '../i18n'
import { IconArrow } from './Icons'
import {
  serpSearch, findRozetkaUrl, findShopsUrl,
  parseRozetka, parseShops,
  buildRozetkaQuery, buildShopsQuery, getPartNumbers,
  extractRozetkaPrice, fetchParts,
} from '../api'
import { cacheGet, cacheSet, cacheInvalidate, cacheGetRozetka, cacheSetRozetka, cacheGetShops, cacheSetShops } from '../cache'
import { toggleFav, isFav } from '../favorites'
import { setBuildPart, getBuild } from '../builder'
import { trackRozetkaData } from '../popularity'

interface Props {
  part: Part; category: Category; onBack: () => void; tr: Translations
  onAddToCompare?: (part: Part, cat: Category) => void
  onRemoveFromCompare?: (id: string) => void
  compareIds?: string[]
}

type RozState = { status: 'idle'|'searching'|'parsing'|'done'|'error'; data?: RozetkaResult; error?: string; rozetkaUrl?: string; fromCache?: boolean }
type ShopsState = { status: 'idle'|'searching'|'parsing'|'done'|'error'; data?: ShopsResult; error?: string; fromCache?: boolean }

function parsePrice(p: string): number {
  const n = parseFloat(p.replace(/[^\d.]/g, ''))
  return isNaN(n) ? Infinity : n
}

export default function PartDetail({ part, category, onBack, tr, onAddToCompare, onRemoveFromCompare, compareIds = [] }: Props) {
  const [freshPart, setFreshPart] = useState<Part>(part)
  const [roz, setRoz]           = useState<RozState>({ status: 'idle' })
  const [hot, setHot]           = useState<ShopsState>({ status: 'idle' })
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null)
  const [liked, setLiked] = useState(() => isFav(part.opendb_id))
  const [inBuild, setInBuild] = useState(() => Object.values(getBuild()).some(e => e?.part.opendb_id === part.opendb_id))
  const inCompare = compareIds.includes(part.opendb_id)
  const [tab, setTab] = useState<'shops' | 'specs'>('shops')
  const partNumbers = getPartNumbers(part)
  const cacheId = part.opendb_id

  useEffect(() => {
    setFreshPart(part) // reset immediately with what we have
    handleRozetka()
    setLiked(isFav(part.opendb_id))
    setInBuild(Object.values(getBuild()).some(e => e?.part.opendb_id === part.opendb_id))
    // Refresh part data from API to get full fields (URL hash may lose numeric 0s)
    fetchParts(part._category as Category ?? category, { opendb_id: part.opendb_id, limit: 1 })
      .then(data => { if (data.length > 0) setFreshPart(data[0]) })
      .catch(() => { /* silent, use cached part */ })
  }, [part.opendb_id])

  useEffect(() => {
    if (!lightbox) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox(l => l && { ...l, idx: (l.idx + 1) % l.photos.length })
      if (e.key === 'ArrowLeft')  setLightbox(l => l && { ...l, idx: (l.idx - 1 + l.photos.length) % l.photos.length })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [lightbox])

  async function handleRozetka(forceRefresh = false) {
    if (!forceRefresh) {
      // Try full data cache first (6h TTL)
      const cachedData = cacheGetRozetka(cacheId)
      if (cachedData) {
        setRoz({ status: 'done', data: cachedData, rozetkaUrl: cachedData.url, fromCache: true })
        return
      }
      // Fall back to URL cache only
      const cached = cacheGet(cacheId, 'rozetka')
      if (cached) {
        setRoz({ status: 'parsing', rozetkaUrl: cached, fromCache: true })
        try {
          const data = await parseRozetka(cached)
          if (!data.price) { /* keep going */ } else {
            cacheSetRozetka(cacheId, data as any)
            if (data.rating || data.reviews_count) trackRozetkaData(cacheId, parseFloat(data.rating || '0'), parseInt(data.reviews_count || '0', 10))
            setRoz({ status: 'done', data, rozetkaUrl: cached, fromCache: true })
            return
          }
        } catch { cacheInvalidate(cacheId, 'rozetka') }
      }
    }
    setRoz({ status: 'searching' })
    try {
      let results = await serpSearch(buildRozetkaQuery(part))
      let url = findRozetkaUrl(results)
      if (!url && part.name) { results = await serpSearch(`${part.name} site:rozetka.com.ua`); url = findRozetkaUrl(results) }
      if (!url) { setRoz({ status: 'error', error: `No Rozetka product page found (${results.length} results)` }); return }
      cacheSet(cacheId, 'rozetka', url)
      const serpPrice = extractRozetkaPrice(results)
      setRoz({ status: 'parsing', rozetkaUrl: url })
      const data = await parseRozetka(url)
      if (!data.price && serpPrice) data.price = serpPrice.price
      if (data.rating || data.reviews_count) trackRozetkaData(cacheId, parseFloat(data.rating || '0'), parseInt(data.reviews_count || '0', 10))
      // Cache full data
      if (data.price) cacheSetRozetka(cacheId, data as any)
      setRoz({ status: 'done', data, rozetkaUrl: url })
    } catch (e) { setRoz({ status: 'error', error: e instanceof Error ? e.message : 'Error' }) }
  }

  async function handleShops(forceRefresh = false) {
    if (!forceRefresh) {
      // Try full shops data cache (4h TTL)
      const cachedShops = cacheGetShops(cacheId)
      if (cachedShops) {
        const data: ShopsResult = {
          url: cacheGet(cacheId, 'shops') ?? '',
          photos: cachedShops.photos,
          total_shops: cachedShops.shopCount,
          shops: [{ shop_name: '', price: '', shop_url: '' }, ...cachedShops.shops.map(s => ({ shop_name: s.name, price: s.price, shop_url: s.url }))]
        }
        setHot({ status: 'done', data, fromCache: true }); return
      }
      const cached = cacheGet(cacheId, 'shops')
      const isValid = (u: string) =>
        /hotline\.ua\/.*\/[^/]+-[^/]+\/?$/.test(u) && !/\/fs\/\d+|\/c\d+\/|processory\/?$|\/computer\/?$/.test(u)
      if (cached && isValid(cached)) {
        setHot({ status: 'parsing', fromCache: true })
        try {
          const data = await parseShops(cached)
          _cacheShopsData(data)
          setHot({ status: 'done', data, fromCache: true }); return
        } catch { cacheInvalidate(cacheId, 'shops') }
      } else if (cached) { cacheInvalidate(cacheId, 'shops') }
    }
    setHot({ status: 'searching' })
    try {
      let results = await serpSearch(buildShopsQuery(part))
      let url = findShopsUrl(results)
      if (!url && part.name) { results = await serpSearch(`${part.name} site:hotline.ua`); url = findShopsUrl(results) }
      if (!url) { setHot({ status: 'error', error: `No shops page found (${results.length} results)` }); return }
      cacheSet(cacheId, 'shops', url)
      setHot({ status: 'parsing' })
      const data = await parseShops(url)
      _cacheShopsData(data)
      setHot({ status: 'done', data })
    } catch (e) { setHot({ status: 'error', error: e instanceof Error ? e.message : 'Error' }) }
  }

  function _cacheShopsData(data: ShopsResult) {
    const shops = data.shops.slice(1)
    const prices = shops.map(s => parseFloat(s.price.replace(/[^\d.]/g, ''))).filter(n => !isNaN(n))
    cacheSetShops(cacheId, {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      shopCount: shops.length,
      shops: shops.map(s => ({ name: s.shop_name, price: s.price, url: s.shop_url })),
      photos: data.photos ?? []
    })
  }

  const allPhotos = [
    ...(hot.data?.photos ?? []),
    ...(roz.data?.image ? [roz.data.image] : []),
  ].filter(Boolean)

  const specs   = buildSpecList(freshPart, category, tr)
  const rozBusy = roz.status === 'searching' || roz.status === 'parsing'
  const hotBusy = hot.status === 'searching' || hot.status === 'parsing'
  const mainImg = roz.data?.image || null

  return (
    <div className="detail">
      {lightbox && (
        <Lightbox
          photos={lightbox.photos} idx={lightbox.idx}
          onClose={() => setLightbox(null)}
          onNext={() => setLightbox(l => l && { ...l, idx: (l.idx + 1) % l.photos.length })}
          onPrev={() => setLightbox(l => l && { ...l, idx: (l.idx - 1 + l.photos.length) % l.photos.length })}
        />
      )}

      <button className="back-btn" onClick={onBack}>{tr.backToCatalog}</button>

      {/* ── Hero: image + title + price PROMINENT ── */}
      <div className="detail-hero">
        {/* Photo column */}
        <div className="detail-photo-col">
          <PhotoViewer
            mainImg={mainImg}
            allPhotos={allPhotos}
            loading={rozBusy}
            partName={part.name}
            onOpenLightbox={(idx) => setLightbox({ photos: allPhotos.length ? allPhotos : (mainImg ? [mainImg] : []), idx })}
          />
        </div>

        {/* Info column */}
        <div className="detail-info-col">
          <div className="detail-category-badge">{category.toUpperCase()}</div>
          <h1 className="detail-name">{part.name}</h1>
          <p className="detail-mfr">{part.manufacturer}{part.series ? ` · ${part.series}` : ''}</p>
          {partNumbers.length > 0 && (
            <div className="detail-pns">
              {partNumbers.map(pn => <span key={pn} className="pn-badge">{pn}</span>)}
            </div>
          )}

          <div className="detail-action-row">
            <button
              className={"detail-action-btn fav-action" + (liked ? " liked" : "")}
              onClick={() => { const now = toggleFav(part, category); setLiked(now) }}
              title={liked ? tr.removeFromFavs : tr.addToFavs}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {liked ? tr.savedToFavs : tr.addToFavs}
            </button>
            <button
              className={"detail-action-btn build-action" + (inBuild ? " added" : "")}
              onClick={() => { setBuildPart(category, part); setInBuild(true) }}
              title={inBuild ? tr.inBuildTitle : tr.addToBuildTitle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              {inBuild ? tr.inBuild : tr.addToBuild}
            </button>
            {onAddToCompare && (
              <button
                className={"detail-action-btn compare-action" + (inCompare ? " added" : "")}
                onClick={() => inCompare ? onRemoveFromCompare?.(part.opendb_id) : onAddToCompare(part, category)}
                title={tr.compareAdd}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
                {inCompare ? tr.compare : tr.compareAdd}
              </button>
            )}
          </div>

          {/* Price blocks row */}
          <div className="detail-prices-row">
            {/* Rozetka price */}
            <div className="detail-price-block roz-price-block">
              {rozBusy && <div className="detail-price-skeleton" />}
              {roz.status === 'done' && roz.data?.price && (
                <div className="detail-price">{roz.data.price}</div>
              )}
              {roz.status === 'done' && roz.data?.rating && (
                <div className="detail-rating-row">
                  <Stars rating={parseFloat(roz.data.rating)} />
                  <span className="roz-rating-val">{roz.data.rating}</span>
                  {roz.data.reviews_count && (
                    <span className="roz-reviews">({roz.data.reviews_count} {tr.reviews})</span>
                  )}
                </div>
              )}
              {roz.status === 'done' && roz.data && (
                <a href={roz.data.url} target="_blank" rel="noreferrer" className="detail-buy-btn">
                  {tr.viewOnRozetka}
                  <IconArrow size={14} />
                </a>
              )}
            </div>

            {/* Shops price range — shown after shops loaded */}
            {hot.status === 'done' && hot.data && (() => {
              const shops = hot.data.shops.slice(1).filter(s => s.price !== '—')
              const prices = shops.map(s => parseFloat(s.price.replace(/[^\d.]/g, ''))).filter(n => !isNaN(n))
              if (!prices.length) return null
              const min = Math.min(...prices); const max = Math.max(...prices)
              return (
                <div className="detail-price-block shops-price-block">
                  <div className="shops-price-label">
                    <span className="source-dot dot-hot" style={{width:6,height:6}} />
                    {tr.shops}
                  </div>
                  <div className="shops-price-range">
                    <span className="shops-price-min">{min.toLocaleString('uk-UA')} ₴</span>
                    {min !== max && <>
                      <span className="shops-price-sep">—</span>
                      <span className="shops-price-max">{max.toLocaleString('uk-UA')} ₴</span>
                    </>}
                  </div>
                  <div className="shops-price-count">{shops.length} {tr.shopsLabel}</div>
                </div>
              )
            })()}
          </div>

          {/* Rozetka refresh controls — compact */}
          <div className="detail-roz-controls">
            <span className="detail-roz-label">
              <span className="source-dot dot-roz" /> Rozetka
              {roz.fromCache && <span className="cache-badge">cached</span>}
            </span>
            <div className="source-actions">
              {roz.status === 'done' && roz.fromCache && (
                <button className="refresh-btn ghost" onClick={() => handleRozetka(true)}>↺</button>
              )}
              <button className="refresh-btn" onClick={() => handleRozetka()} disabled={rozBusy}>
                {roz.status === 'searching' ? tr.searching : rozBusy ? tr.parsing : tr.refresh}
              </button>
            </div>
          </div>
          {roz.status === 'error' && <ErrMsg msg={roz.error!} />}


        </div>
      </div>

      {/* ── Tabs: shops | specs ── */}
      <div className="detail-tabs-section">
        <div className="detail-tabs-nav">
          <button
            className={"detail-tab" + (tab === 'shops' ? ' active' : '')}
            onClick={() => setTab('shops')}
          >
            <span className="source-dot dot-hot" style={{width:6,height:6}} />
            {tr.shops}
          </button>
          <button
            className={"detail-tab" + (tab === 'specs' ? ' active' : '')}
            onClick={() => setTab('specs')}
          >
            {tr.specifications}
          </button>
        </div>

        <div className="detail-tab-content">
          {tab === 'shops' && (
            <div className="source-block shops-block tab-panel">
              <div className="source-header">
                <h2 className="block-title">
                  <span className="source-dot dot-hot" />
                  {tr.shops}
                  {hot.fromCache && <span className="cache-badge">cached</span>}
                </h2>
                {hot.status === 'idle'
                  ? <button className="shops-trigger-btn" onClick={() => handleShops()}>{tr.findShops}</button>
                  : <div className="source-actions">
                      {hot.status === 'done' && hot.fromCache && (
                        <button className="refresh-btn ghost" onClick={() => handleShops(true)}>↺</button>
                      )}
                      <button className="refresh-btn" onClick={() => handleShops()} disabled={hotBusy}>
                        {hotBusy ? tr.searching : tr.refresh}
                      </button>
                    </div>
                }
              </div>
              {hot.status === 'idle' && <div className="shops-idle"><p>{tr.findShops}</p></div>}
              {hotBusy && <div className="status-line"><Spinner /> {hot.status === 'searching' ? tr.searching : tr.parsingShops}</div>}
              {hot.status === 'error' && <ErrMsg msg={hot.error!} />}
              {hot.status === 'done' && hot.data && <ShopList data={hot.data} tr={tr} />}
            </div>
          )}

          {tab === 'specs' && (
            <div className="specs-block tab-panel">
              <table className="specs-table specs-table-sm"><tbody>
                {specs.map(([k, v]) => (
                  <tr key={k}><td className="spec-key">{k}</td><td className="spec-val">{v}</td></tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Photo viewer with zoom controls ──────────────────────────────────────────
function PhotoViewer({ mainImg, allPhotos, loading, partName, onOpenLightbox }: {
  mainImg: string | null
  allPhotos: string[]
  loading: boolean
  partName: string
  onOpenLightbox: (idx: number) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [activeIdx, setActiveIdx] = useState(0)

  const photos = allPhotos.length > 0 ? allPhotos : (mainImg ? [mainImg] : [])
  const current = photos[activeIdx] ?? mainImg

  const zoomIn  = () => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))
  const zoomOut = () => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))
  const zoomReset = () => setZoom(1)

  if (loading) return <div className="photo-viewer skeleton-img" />
  if (!current) return null

  return (
    <div className="photo-viewer">
      {/* Main image with zoom */}
      <div className="photo-main-wrap" onClick={() => onOpenLightbox(activeIdx)}>
        <img
          src={current}
          alt={partName}
          className="photo-main-img"
          style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
          onClick={e => { if (zoom > 1) { e.stopPropagation(); zoomReset() } }}
        />
      </div>

      {/* Zoom controls */}
      <div className="photo-controls">
        <button className="photo-ctrl-btn" onClick={zoomOut} disabled={zoom <= 1} title="Zoom out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <button className="photo-ctrl-zoom-val" onClick={zoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="photo-ctrl-btn" onClick={zoomIn} disabled={zoom >= 3} title="Zoom in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
        </button>
        <div className="photo-ctrl-sep" />
        <button className="photo-ctrl-btn" onClick={() => onOpenLightbox(activeIdx)} title="Open fullscreen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="photo-thumbs">
          {photos.map((p, i) => (
            <button
              key={i}
              className={`photo-thumb${i === activeIdx ? ' active' : ''}`}
              onClick={() => { setActiveIdx(i); setZoom(1) }}
            >
              <img src={p} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photos, idx, onClose, onNext, onPrev }: {
  photos: string[]; idx: number
  onClose: () => void; onNext: () => void; onPrev: () => void
}) {
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      {photos.length > 1 && (
        <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); onPrev() }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}
      <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
        <img src={photos[idx]} alt="" className="lb-img" />
      </div>
      {photos.length > 1 && (
        <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); onNext() }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}
      {photos.length > 1 && (
        <div className="lb-counter" onClick={e => e.stopPropagation()}>{idx + 1} / {photos.length}</div>
      )}
      {photos.length > 1 && (
        <div className="lb-dots" onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => <button key={i} className={`lb-dot${i === idx ? ' active' : ''}`} onClick={onClose} />)}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner() { return <span className="spinner" /> }

function ErrMsg({ msg }: { msg: string }) {
  return (
    <div className="error-msg">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {msg}
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars">
      {[1,2,3,4,5].map(i => <span key={i} className={`star ${i <= Math.round(rating) ? 'filled' : ''}`}>★</span>)}
    </span>
  )
}

type ShopSort = 'asc' | 'desc'

function ShopList({ data, tr }: { data: ShopsResult; tr: Translations }) {
  const [sort, setSort] = useState<ShopSort>('asc')
  const shops     = data.shops.slice(1)
  const withPrice = [...shops.filter(s => s.price !== '—')].sort((a, b) =>
    sort === 'asc' ? parsePrice(a.price) - parsePrice(b.price) : parsePrice(b.price) - parsePrice(a.price)
  )
  const noPrice = shops.filter(s => s.price === '—')

  return (
    <div className="shops-list">
      <div className="shops-summary">
        <span>{tr.found} <strong>{shops.length}</strong> {tr.shopsLabel} · <strong>{withPrice.length}</strong> {tr.withPrice}</span>
        {withPrice.length > 1 && (
          <button className="shop-sort-btn" onClick={() => setSort(s => s === 'asc' ? 'desc' : 'asc')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
            {sort === 'asc' ? tr.fromCheap : tr.fromExpensive}
          </button>
        )}
      </div>
      <div className="shop-list">
        {withPrice.map((shop, i) => (
          <a key={i} href={shop.shop_url} target="_blank" rel="noreferrer" className="shop-row has-price">
            {i === 0 && <span className="shop-rank best">1</span>}
            <span className="shop-name">{shop.shop_name}</span>
            <span className="shop-price">{shop.price}</span>
            <IconArrow size={13} className="shop-arrow-icon" />
          </a>
        ))}
        {noPrice.length > 0 && (
          <details className="no-price-group">
            <summary className="no-price-summary">{tr.shopsNoPrice(noPrice.length)}</summary>
            {noPrice.map((shop, i) => (
              <a key={i} href={shop.shop_url} target="_blank" rel="noreferrer" className="shop-row">
                <span className="shop-name">{shop.shop_name}</span>
                <span className="shop-price-none">{tr.priceNotFound}</span>
                <IconArrow size={13} className="shop-arrow-icon" />
              </a>
            ))}
          </details>
        )}
      </div>
    </div>
  )
}


// ── Value formatter ───────────────────────────────────────────────────────────
function formatValue(val: unknown): string {
  if (val == null || val === '' || val === undefined) return ''
  // Numeric 0 is valid (e.g. SATA: 0)
  if (val === 0) return '0'
  const s = String(val)

  // Try to parse JSON arrays/objects
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s)
      // Array of objects (like M.2 slots)
      if (Array.isArray(parsed)) {
        // Deduplicate and format each item
        const formatted = parsed.map(item => {
          if (typeof item === 'object' && item !== null) {
            const parts: string[] = []
            if (item.size) parts.push(item.size)
            if (item.interface) parts.push(item.interface)
            if (item.key && item.key !== 'M') parts.push(`key ${item.key}`)
            return parts.join(' ')
          }
          return String(item)
        })
        // Deduplicate
        const unique = [...new Set(formatted)]
        if (unique.length === 1) return `${unique[0]} ×${parsed.length}`
        return unique.map(u => {
          const count = formatted.filter(f => f === u).length
          return count > 1 ? `${u} ×${count}` : u
        }).join(', ')
      }
      // Plain object
      if (typeof parsed === 'object') {
        return Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ')
      }
    } catch { /* not JSON */ }
  }

  // Boolean-like
  if (s === '1') return '✓'
  if (s === '0') return '✗'

  // String array ["DDR5","DDR4"]
  if (s.startsWith('["')) {
    try {
      const arr = JSON.parse(s) as string[]
      return arr.join(', ')
    } catch { /* not JSON */ }
  }

  return s
}

function buildSpecList(part: Part, category: Category, tr: Translations): [string, string][] {
  const r = (k: string, v: unknown) => { const fv = formatValue(v); return fv ? [k, fv] as [string, string] : null }
  const yn = (v: number | undefined) => v === 1 ? tr.yes : v === 0 ? tr.no : undefined
  const rows = {
    cpu: [r(tr.socket,part.socket),r(tr.architecture,part.microarchitecture),r(tr.cores,part.total_cores),r(tr.threads,part.threads),r(tr.baseClock,part.base_clock_ghz&&`${part.base_clock_ghz} GHz`),r(tr.boostClock,part.boost_clock_ghz&&`${part.boost_clock_ghz} GHz`),r(tr.l3cache,part.l3_cache_mb&&`${part.l3_cache_mb} MB`),r(tr.tdp,part.tdp_w&&`${part.tdp_w} W`),r(tr.igpu,part.integrated_graphics),r(tr.memory,part.memory_types),r(tr.lithography,part.lithography)],
    gpu: [r(tr.chipset,part.chipset),r(tr.memory,part.memory_gb&&`${part.memory_gb} GB`),r(tr.memoryType,part.memory_type),r(tr.coreBase,part.core_base_clock_mhz&&`${part.core_base_clock_mhz} MHz`),r(tr.coreBoost,part.core_boost_clock_mhz&&`${part.core_boost_clock_mhz} MHz`),r(tr.busWidth,part.memory_bus_bit&&`${part.memory_bus_bit}-bit`),r(tr.tdp,part.tdp_w&&`${part.tdp_w} W`),r(tr.length,part.length_mm&&`${part.length_mm} mm`),r(tr.slotWidth,part.total_slot_width),r(tr.interface,part.interface)],
    motherboard: [r(tr.socket,part.socket),r(tr.chipset,part.chipset),r(tr.formFactor,part.form_factor),r(tr.ramType,part.ram_type),r(tr.ramSlots,part.ram_slots),r(tr.maxRam,part.max_memory_gb&&`${part.max_memory_gb} GB`),r(tr.sata,part.sata_6gbs),r(tr.m2,part.m2_slots),r(tr.wifi,part.wifi),r(tr.bluetooth,part.bluetooth)],
    ram: [r(tr.ramType,part.ram_type),r(tr.formFactor,part.form_factor),r(tr.capacity,part.total_capacity_gb&&`${part.total_capacity_gb} GB`),r(tr.modules,part.module_count),r(tr.speed,part.speed_mhz&&`${part.speed_mhz} MHz`),r(tr.casLatency,part.cas_latency&&`CL${part.cas_latency}`),r(tr.voltage,part.voltage_v&&`${part.voltage_v} V`),r(tr.rgb,part.rgb),r(tr.profiles,part.profile_support)],
    psu: [r(tr.wattage,part.wattage&&`${part.wattage} W`),r(tr.formFactor,part.form_factor),r(tr.efficiency,part.efficiency_rating),r(tr.modular,part.modular),r(tr.length,part.length_mm&&`${part.length_mm} mm`),r(tr.fanless,part.fanless),r(tr.atx24,part.conn_atx_24pin),r(tr.eps8,part.conn_eps_8pin),r(tr.pcie62,part.conn_pcie_6p2pin),r(tr.sataConn,part.conn_sata)],
    storage: [r(tr.storageType,part.storage_type),r(tr.formFactor,part.form_factor),r(tr.interface,part.interface),r(tr.capacity,part.capacity_gb&&`${part.capacity_gb} GB`),r(tr.nvme,part.nvme),r(tr.readSpeed,part.read_speed_mbs&&`${part.read_speed_mbs} MB/s`),r(tr.writeSpeed,part.write_speed_mbs&&`${part.write_speed_mbs} MB/s`),r(tr.cache,part.cache_mb&&`${part.cache_mb} MB`),r(tr.rpm,part.rpm)],
  }
  return (rows[category]??[]).filter(Boolean) as [string,string][]
}