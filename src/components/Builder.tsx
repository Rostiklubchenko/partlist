import { useState, useEffect } from 'react'
import { getBuild, setBuildPart, removeBuildPart, clearBuild, getCompatHints, SLOTS, getCachedPrice, type Build, type BuildSlot } from '../builder'
import { cacheGet } from '../cache'
import { fetchParts } from '../api'
import type { Part, Category } from '../types'
import type { Translations } from '../i18n'
import { CategoryIcon } from './Icons'

function getSlotLabel(slot: BuildSlot, tr: Translations): string {
  const labels: Record<BuildSlot, string> = {
    cpu: tr.cpu, motherboard: tr.motherboard, ram: tr.ram,
    gpu: tr.gpu, psu: tr.psu, storage: tr.storage,
  }
  return labels[slot]
}

interface Props { tr: Translations; onSelectSlot: (cat: Category) => void; onViewPart: (part: Part, cat: Category) => void }

export default function Builder({ tr, onSelectSlot, onViewPart }: Props) {
  const [build, setBuild] = useState<Build>({})
  const [hints, setHints]   = useState<string[]>([])
  const [cleared, setCleared] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>({})

  useEffect(() => {
    const sync = () => { const b = getBuild(); setBuild(b); setHints(getCompatHints(b)) }
    sync()
    window.addEventListener('build-updated', sync)
    return () => window.removeEventListener('build-updated', sync)
  }, [])

  // Sync prices state from cache on mount and when build changes
  useEffect(() => {
    const loadPrices = () => {
      const newPrices: Record<string, string> = {}
      SLOTS.forEach(s => {
        const e = build[s]
        if (!e) return
        const p = getCachedPrice(e.part.opendb_id) ?? e.cachedPrice
        if (p) newPrices[e.part.opendb_id] = p
      })
      setPrices(newPrices)
    }
    loadPrices()

    // Auto-fetch for parts that have URL cached but no price
    const missingPrices = SLOTS.filter(s => {
      const e = build[s]
      return e && !getCachedPrice(e.part.opendb_id) && !e.cachedPrice
    })
    missingPrices.forEach(async (slot) => {
      const entry = build[slot]
      if (!entry) return
      try {
        const raw = localStorage.getItem(`partlist_url_rozetka_${entry.part.opendb_id}`)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (!parsed?.data) return
        const { parseRozetka } = await import('../api')
        const data = await parseRozetka(parsed.data)
        if (data.price) {
          const { cacheSetRozetka } = await import('../cache')
          cacheSetRozetka(entry.part.opendb_id, data as any)
          setBuildPart(slot, entry.part, data.price)
          // Update prices state immediately — triggers re-render
          setPrices(prev => ({ ...prev, [entry.part.opendb_id]: data.price }))
        }
      } catch { /* silent */ }
    })
  }, [build])

  function handleRemove(slot: BuildSlot) { removeBuildPart(slot) }
  function handleClear() { clearBuild(); setCleared(true); setTimeout(() => setCleared(false), 1500) }

  // Calculate total from prices state (reactive, updates when prices load)
  const total = SLOTS.reduce((sum, slot) => {
    const entry = build[slot]
    if (!entry) return sum
    const price = prices[entry.part.opendb_id] ?? null
    if (!price) return sum
    const num = parseFloat(price.replace(/[^\d.]/g, ''))
    return isNaN(num) ? sum : sum + num
  }, 0)

  const filled = SLOTS.filter(s => build[s]).length

  return (
    <div className="builder">
      <div className="builder-header">
        <div className="builder-title-row">
          <h2 className="builder-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            {tr.builderTitle}
          </h2>
          <div className="builder-meta">
            <span className="builder-progress">{tr.builderProgress(filled, SLOTS.length)}</span>
            {filled > 0 && (
              <button className="builder-clear-btn" onClick={handleClear}>
                {cleared ? tr.builderCleared : tr.builderClearAll}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="builder-progress-bar">
          <div className="builder-progress-fill" style={{ width: `${(filled / SLOTS.length) * 100}%` }} />
        </div>
      </div>

      {/* Compatibility hints */}
      {hints.length > 0 && (
        <div className="builder-hints">
          {hints.map((h, i) => (
            <div key={i} className="builder-hint">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {h}
            </div>
          ))}
        </div>
      )}

      {/* Slot list */}
      <div className="builder-slots">
        {SLOTS.map(slot => {
          const entry = build[slot]
          return (
            <div key={slot} className={`builder-slot${entry ? ' filled' : ''}`}>
              <div className="builder-slot-icon">
                <CategoryIcon id={slot as Category} size={16} />
              </div>

              <div className="builder-slot-info">
                <div className="builder-slot-label">{getSlotLabel(slot, tr)}</div>
                {entry ? (
                  <>
                    <button
                      className="builder-slot-name-btn"
                      onClick={() => onViewPart(entry.part, entry.category)}
                    >{entry.part.name}</button>
                    {prices[entry.part.opendb_id] && <div className="builder-slot-price">{prices[entry.part.opendb_id]}</div>}
                  </>
                ) : (
                  <div className="builder-slot-empty">{tr.builderNotSelected}</div>
                )}
              </div>

              <div className="builder-slot-actions">
                {entry && (
                  <button className="builder-slot-remove" onClick={() => handleRemove(slot)} title="Remove">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
                <button
                  className="builder-slot-pick"
                  onClick={() => onSelectSlot(slot as Category)}
                >
                  {entry ? tr.builderChange : tr.builderPick}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total */}
      {filled > 0 && (
        <div className="builder-footer">
          <div className="builder-total">
            <div className="builder-total-left">
              <span className="builder-total-label">{tr.builderTotal}</span>
              <span className="builder-total-note">Rozetka</span>
            </div>
            <span className="builder-total-price">
              {total > 0 ? `${total.toLocaleString('uk-UA')} ₴` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}