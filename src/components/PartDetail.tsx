import { useState, useEffect } from 'react'
import type { Part, Category, RozetkaResult, HotlineResult } from '../types'
import type { Translations } from '../i18n'
import { IconArrow } from './Icons'
import {
  serpSearch, findRozetkaUrl, findHotlineUrl,
  parseRozetka, parseHotline,
  buildRozetkaQuery, buildHotlineQuery, getPartNumbers,
  extractRozetkaPrice,
} from '../api'
import { cacheGet, cacheSet, cacheInvalidate } from '../cache'

interface Props {
  part: Part; category: Category; onBack: () => void; tr: Translations
}

type RozState = { status: 'idle'|'cache'|'searching'|'parsing'|'done'|'error'; data?: RozetkaResult; error?: string; rozetkaUrl?: string; fromCache?: boolean }
type HotState = { status: 'idle'|'cache'|'searching'|'parsing'|'done'|'error'; data?: HotlineResult; error?: string; hotlineUrl?: string; fromCache?: boolean }

export default function PartDetail({ part, category, onBack, tr }: Props) {
  const [roz, setRoz] = useState<RozState>({ status: 'idle' })
  const [hot, setHot] = useState<HotState>({ status: 'idle' })
  const partNumbers = getPartNumbers(part)
  const cacheId = part.opendb_id

  useEffect(() => { handleRozetka() }, [part.opendb_id])

  async function handleRozetka(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cached = cacheGet(cacheId, 'rozetka')
      if (cached) {
        console.log('[Cache] Rozetka HIT:', cached)
        setRoz({ status: 'parsing', rozetkaUrl: cached, fromCache: true })
        try {
          const data = await parseRozetka(cached)
          setRoz({ status: 'done', data, rozetkaUrl: cached, fromCache: true })
          return
        } catch {
          // Cache URL stale — fall through to fresh search
          cacheInvalidate(cacheId, 'rozetka')
        }
      }
    }

    setRoz({ status: 'searching' })
    try {
      let results = await serpSearch(buildRozetkaQuery(part))
      let url = findRozetkaUrl(results)
      if (!url && part.name) {
        results = await serpSearch(`${part.name} site:rozetka.com.ua`)
        url = findRozetkaUrl(results)
      }
      if (!url) {
        setRoz({ status: 'error', error: `No Rozetka product page found (${results.length} results)` })
        return
      }
      // Save to cache
      cacheSet(cacheId, 'rozetka', url)
      const serpPrice = extractRozetkaPrice(results)
      setRoz({ status: 'parsing', rozetkaUrl: url })
      const data = await parseRozetka(url)
      if (!data.price && serpPrice) data.price = serpPrice.price
      setRoz({ status: 'done', data, rozetkaUrl: url })
    } catch (e) { setRoz({ status: 'error', error: e instanceof Error ? e.message : 'Error' }) }
  }

  async function handleHotline(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = cacheGet(cacheId, 'hotline')
      if (cached) {
        console.log('[Cache] Hotline HIT:', cached)
        setHot({ status: 'parsing', hotlineUrl: cached, fromCache: true })
        try {
          const data = await parseHotline(cached)
          setHot({ status: 'done', data, hotlineUrl: cached, fromCache: true })
          return
        } catch {
          cacheInvalidate(cacheId, 'hotline')
        }
      }
    }

    setHot({ status: 'searching' })
    try {
      let results = await serpSearch(buildHotlineQuery(part))
      let url = findHotlineUrl(results)
      if (!url && part.name) {
        results = await serpSearch(`${part.name} site:hotline.ua`)
        url = findHotlineUrl(results)
      }
      if (!url) { setHot({ status: 'error', error: `No shops page found (${results.length} results)` }); return }
      cacheSet(cacheId, 'hotline', url)
      setHot({ status: 'parsing', hotlineUrl: url })
      const data = await parseHotline(url)
      setHot({ status: 'done', data, hotlineUrl: url })
    } catch (e) { setHot({ status: 'error', error: e instanceof Error ? e.message : 'Error' }) }
  }

  const specs = buildSpecList(part, category, tr)
  const rozBusy = roz.status === 'searching' || roz.status === 'parsing' || roz.status === 'cache'
  const hotBusy = hot.status === 'searching' || hot.status === 'parsing' || hot.status === 'cache'

  return (
    <div className="detail">
      <button className="back-btn" onClick={onBack}>{tr.backToCatalog}</button>

      <div className="detail-layout">
        <div className="detail-left">
          <div className="detail-header">
            {roz.data?.image
              ? <div className="detail-img-wrap"><img src={roz.data.image} alt={part.name} className="detail-img" /></div>
              : rozBusy ? <div className="detail-img-wrap skeleton-img" /> : null
            }
            <div className="detail-title-block">
              <div className="detail-category-badge">{category.toUpperCase()}</div>
              <h1 className="detail-name">{part.name}</h1>
              <p className="detail-mfr">{part.manufacturer}{part.series ? ` · ${part.series}` : ''}</p>
              {partNumbers.length > 0 && (
                <div className="detail-pns">
                  {partNumbers.map(pn => <span key={pn} className="pn-badge">{pn}</span>)}
                </div>
              )}
            </div>
          </div>

          <div className="specs-block">
            <h2 className="block-title">{tr.specifications}</h2>
            <table className="specs-table"><tbody>
              {specs.map(([k, v]) => (
                <tr key={k}><td className="spec-key">{k}</td><td className="spec-val">{v}</td></tr>
              ))}
            </tbody></table>
          </div>

          <div className="source-block rozetka-block">
            <div className="source-header">
              <h2 className="block-title">
                <span className="source-dot dot-roz" />
                Rozetka
                {roz.fromCache && <span className="cache-badge">cached</span>}
              </h2>
              <div className="source-actions">
                {roz.status === 'done' && roz.fromCache && (
                  <button className="refresh-btn ghost" onClick={() => handleRozetka(true)} title="Force refresh">↺</button>
                )}
                <button className="refresh-btn" onClick={() => handleRozetka()} disabled={rozBusy}>
                  {roz.status === 'searching' ? tr.searching : rozBusy ? tr.parsing : tr.refresh}
                </button>
              </div>
            </div>
            {rozBusy && <RozSkeleton />}
            {roz.status === 'error' && <div className="error-msg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {roz.error}</div>}
            {roz.status === 'done' && roz.data && <RozetkaCard data={roz.data} tr={tr} />}
          </div>
        </div>

        <div className="detail-right">
          <div className="source-block hotline-block">
            <div className="source-header">
              <h2 className="block-title">
                <span className="source-dot dot-hot" />
                {tr.shops}
                {hot.fromCache && <span className="cache-badge">cached</span>}
              </h2>
              {hot.status === 'idle'
                ? <button className="hotline-trigger-btn" onClick={() => handleHotline()}>{tr.findShops}</button>
                : <div className="source-actions">
                    {hot.status === 'done' && hot.fromCache && (
                      <button className="refresh-btn ghost" onClick={() => handleHotline(true)} title="Force refresh">↺</button>
                    )}
                    <button className="refresh-btn" onClick={() => handleHotline()} disabled={hotBusy}>
                      {hotBusy ? tr.searching : tr.refresh}
                    </button>
                  </div>
              }
            </div>
            {hot.status === 'idle' && <div className="hotline-idle"><p>{tr.findShops}</p></div>}
            {hotBusy && <div className="status-line"><Spinner /> {hot.status === 'searching' ? tr.searching : tr.parsingShops}</div>}
            {hot.status === 'error' && <div className="error-msg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {hot.error}</div>}
            {hot.status === 'done' && hot.data && <ShopList data={hot.data} tr={tr} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() { return <span className="spinner" /> }

function RozSkeleton() {
  return (
    <div className="roz-card skeleton-roz">
      <div className="skel skel-img" />
      <div className="skel-info">
        <div className="skel skel-title" /><div className="skel skel-price" /><div className="skel skel-rating" />
      </div>
    </div>
  )
}

function RozetkaCard({ data, tr }: { data: RozetkaResult; tr: Translations }) {
  return (
    <div className="roz-card">
      {data.image && <div className="roz-img-wrap"><img src={data.image} alt={data.title} className="roz-img" /></div>}
      <div className="roz-info">
        <a href={data.url} target="_blank" rel="noreferrer" className="roz-title">{data.title}</a>
        {data.price && <div className="roz-price">{data.price}</div>}
        {data.rating && (
          <div className="roz-rating">
            <Stars rating={parseFloat(data.rating)} />
            <span className="roz-rating-val">{data.rating}</span>
            {data.reviews_count && <span className="roz-reviews">({data.reviews_count} {tr.reviews})</span>}
          </div>
        )}
        <a href={data.url} target="_blank" rel="noreferrer" className="roz-link-btn">{tr.viewOnRozetka}</a>
      </div>
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

function ShopList({ data, tr }: { data: HotlineResult; tr: Translations }) {
  const shops     = data.shops.slice(1)
  const withPrice = shops.filter(s => s.price !== '—')
  const noPrice   = shops.filter(s => s.price === '—')
  return (
    <div className="hotline-list">
      <div className="hotline-summary">
        {tr.found} <strong>{shops.length}</strong> {tr.shopsLabel} · <strong>{withPrice.length}</strong> {tr.withPrice}
      </div>
      {data.photos.length > 0 && (
        <div className="hotline-photos">
          {data.photos.slice(0, 3).map((p, i) => <img key={i} src={p} alt="" className="hotline-photo" />)}
        </div>
      )}
      <div className="shop-list">
        {withPrice.map((shop, i) => (
          <a key={i} href={shop.hotline_url} target="_blank" rel="noreferrer" className="shop-row has-price">
            <span className="shop-name">{shop.shop_name}</span>
            <span className="shop-price">{shop.price}</span>
            <IconArrow size={13} className="shop-arrow-icon" />
          </a>
        ))}
        {noPrice.length > 0 && (
          <details className="no-price-group">
            <summary className="no-price-summary">{tr.shopsNoPrice(noPrice.length)}</summary>
            {noPrice.map((shop, i) => (
              <a key={i} href={shop.hotline_url} target="_blank" rel="noreferrer" className="shop-row">
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

function buildSpecList(part: Part, category: Category, tr: Translations): [string, string][] {
  const r = (k: string, v: unknown) => v != null && v !== '' ? [k, String(v)] as [string, string] : null
  const yn = (v: number | undefined) => v === 1 ? tr.yes : v === 0 ? tr.no : undefined
  const rows = {
    cpu: [r(tr.socket,part.socket),r(tr.architecture,part.microarchitecture),r(tr.cores,part.total_cores),r(tr.threads,part.threads),r(tr.baseClock,part.base_clock_ghz&&`${part.base_clock_ghz} GHz`),r(tr.boostClock,part.boost_clock_ghz&&`${part.boost_clock_ghz} GHz`),r(tr.l3cache,part.l3_cache_mb&&`${part.l3_cache_mb} MB`),r(tr.tdp,part.tdp_w&&`${part.tdp_w} W`),r(tr.igpu,part.integrated_graphics),r(tr.memory,part.memory_types),r(tr.lithography,part.lithography)],
    gpu: [r(tr.chipset,part.chipset),r(tr.memory,part.memory_gb&&`${part.memory_gb} GB`),r(tr.memoryType,part.memory_type),r(tr.coreBase,part.core_base_clock_mhz&&`${part.core_base_clock_mhz} MHz`),r(tr.coreBoost,part.core_boost_clock_mhz&&`${part.core_boost_clock_mhz} MHz`),r(tr.busWidth,part.memory_bus_bit&&`${part.memory_bus_bit}-bit`),r(tr.tdp,part.tdp_w&&`${part.tdp_w} W`),r(tr.length,part.length_mm&&`${part.length_mm} mm`),r(tr.slotWidth,part.total_slot_width),r(tr.interface,part.interface)],
    motherboard: [r(tr.socket,part.socket),r(tr.chipset,part.chipset),r(tr.formFactor,part.form_factor),r(tr.ramType,part.ram_type),r(tr.ramSlots,part.ram_slots),r(tr.maxRam,part.max_memory_gb&&`${part.max_memory_gb} GB`),r(tr.sata,part.sata_6gbs),r(tr.m2,part.m2_slots),r(tr.wifi,yn(part.wifi as number)),r(tr.bluetooth,yn(part.bluetooth as number))],
    ram: [r(tr.ramType,part.ram_type),r(tr.formFactor,part.form_factor),r(tr.capacity,part.total_capacity_gb&&`${part.total_capacity_gb} GB`),r(tr.modules,part.module_count),r(tr.speed,part.speed_mhz&&`${part.speed_mhz} MHz`),r(tr.casLatency,part.cas_latency&&`CL${part.cas_latency}`),r(tr.voltage,part.voltage_v&&`${part.voltage_v} V`),r(tr.rgb,yn(part.rgb as number)),r(tr.profiles,part.profile_support)],
    psu: [r(tr.wattage,part.wattage&&`${part.wattage} W`),r(tr.formFactor,part.form_factor),r(tr.efficiency,part.efficiency_rating),r(tr.modular,part.modular),r(tr.length,part.length_mm&&`${part.length_mm} mm`),r(tr.fanless,yn(part.fanless as number)),r(tr.atx24,part.conn_atx_24pin),r(tr.eps8,part.conn_eps_8pin),r(tr.pcie62,part.conn_pcie_6p2pin),r(tr.sataConn,part.conn_sata)],
    storage: [r(tr.storageType,part.storage_type),r(tr.formFactor,part.form_factor),r(tr.interface,part.interface),r(tr.capacity,part.capacity_gb&&`${part.capacity_gb} GB`),r(tr.nvme,yn(part.nvme as number)),r(tr.readSpeed,part.read_speed_mbs&&`${part.read_speed_mbs} MB/s`),r(tr.writeSpeed,part.write_speed_mbs&&`${part.write_speed_mbs} MB/s`),r(tr.cache,part.cache_mb&&`${part.cache_mb} MB`),r(tr.rpm,part.rpm)],
  }
  return (rows[category]??[]).filter(Boolean) as [string,string][]
}