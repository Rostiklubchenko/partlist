import { useState, useEffect } from 'react'
import { getBuild, setBuildPart, removeBuildPart, clearBuild, getCompatHints, SLOTS, type Build, type BuildSlot } from '../builder'
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

interface Props { tr: Translations; onSelectSlot: (cat: Category) => void }

export default function Builder({ tr, onSelectSlot }: Props) {
  const [build, setBuild] = useState<Build>({})
  const [hints, setHints]   = useState<string[]>([])
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    const sync = () => { const b = getBuild(); setBuild(b); setHints(getCompatHints(b)) }
    sync()
    window.addEventListener('build-updated', sync)
    return () => window.removeEventListener('build-updated', sync)
  }, [])

  function handleRemove(slot: BuildSlot) { removeBuildPart(slot) }
  function handleClear() { clearBuild(); setCleared(true); setTimeout(() => setCleared(false), 1500) }

  // Estimate total price from cache
  const total = SLOTS.reduce((sum, slot) => {
    const entry = build[slot]
    if (!entry) return sum
    const rawPrice: string | null = entry.cachedPrice ?? null
    if (!rawPrice) return sum
    const num = parseFloat(rawPrice.replace(/[^\d.]/g, ''))
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
                    <div className="builder-slot-name">{entry.part.name}</div>
                    {entry.cachedPrice && (
                      <div className="builder-slot-price">{entry.cachedPrice}</div>
                    )}
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
          {total > 0 ? (
            <div className="builder-total">
              <span className="builder-total-label">~Total</span>
              <span className="builder-total-price">{total.toLocaleString('uk-UA')} ₴</span>
              <span className="builder-total-note">з кешованих цін Rozetka</span>
            </div>
          ) : (
            <p className="builder-total-note">Відкрийте товари щоб побачити ціни</p>
          )}
        </div>
      )}
    </div>
  )
}