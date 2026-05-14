import { useState } from 'react'
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

function formatValue(val: unknown): string {
  if (val == null || val === '' || val === undefined) return '—'
  if (val === 0) return '0'
  const s = String(val)
  if (s === '1') return '✓'
  if (s === '0') return '✗'
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        const formatted = parsed.map(item => {
          if (typeof item === 'object' && item !== null) {
            const parts: string[] = []
            if (item.size) parts.push(item.size)
            if (item.interface) parts.push(item.interface)
            return parts.join(' ')
          }
          return String(item)
        })
        const unique = [...new Set(formatted)]
        if (unique.length === 1) return `${unique[0]} ×${parsed.length}`
        return unique.map(u => {
          const count = formatted.filter(f => f === u).length
          return count > 1 ? `${u} ×${count}` : u
        }).join(', ')
      }
    } catch { /* not JSON */ }
  }
  if (s.startsWith('["')) {
    try { return (JSON.parse(s) as string[]).join(', ') } catch { /* noop */ }
  }
  return s
}

// Fields per category
const FIELDS: Partial<Record<Category, { key: string; label: (tr: Translations) => string }[]>> = {
  cpu: [
    { key: 'manufacturer',        label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'socket',              label: tr => tr.socket },
    { key: 'microarchitecture',   label: tr => tr.architecture },
    { key: 'total_cores',         label: tr => tr.cores },
    { key: 'threads',             label: tr => tr.threads },
    { key: 'base_clock_ghz',      label: tr => tr.baseClock },
    { key: 'boost_clock_ghz',     label: tr => tr.boostClock },
    { key: 'l3_cache_mb',         label: tr => tr.l3cache },
    { key: 'tdp_w',               label: tr => tr.tdp },
    { key: 'integrated_graphics', label: tr => tr.igpu },
    { key: 'lithography',         label: tr => tr.lithography },
    { key: 'memory_types',        label: tr => tr.memory },
  ],
  gpu: [
    { key: 'manufacturer',          label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'chipset',               label: tr => tr.chipset },
    { key: 'memory_gb',             label: tr => tr.memory },
    { key: 'memory_type',           label: tr => tr.memoryType },
    { key: 'core_base_clock_mhz',   label: tr => tr.coreBase },
    { key: 'core_boost_clock_mhz',  label: tr => tr.coreBoost },
    { key: 'memory_bus_bit',        label: tr => tr.busWidth },
    { key: 'tdp_w',                 label: tr => tr.tdp },
    { key: 'length_mm',             label: tr => tr.length },
    { key: 'total_slot_width',      label: tr => tr.slotWidth },
    { key: 'interface',             label: tr => tr.interface },
  ],
  motherboard: [
    { key: 'manufacturer',  label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'socket',        label: tr => tr.socket },
    { key: 'chipset',       label: tr => tr.chipset },
    { key: 'form_factor',   label: tr => tr.formFactor },
    { key: 'ram_type',      label: tr => tr.ramType },
    { key: 'ram_slots',     label: tr => tr.ramSlots },
    { key: 'max_memory_gb', label: tr => tr.maxRam },
    { key: 'sata_6gbs',     label: tr => tr.sata },
    { key: 'm2_slots',      label: tr => tr.m2 },
    { key: 'wifi',          label: tr => tr.wifi },
    { key: 'bluetooth',     label: tr => tr.bluetooth },
  ],
  ram: [
    { key: 'manufacturer',     label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'ram_type',         label: tr => tr.ramType },
    { key: 'form_factor',      label: tr => tr.formFactor },
    { key: 'total_capacity_gb',label: tr => tr.capacity },
    { key: 'module_count',     label: tr => tr.modules },
    { key: 'speed_mhz',        label: tr => tr.speed },
    { key: 'cas_latency',      label: tr => tr.casLatency },
    { key: 'voltage_v',        label: tr => tr.voltage },
    { key: 'rgb',              label: tr => tr.rgb },
    { key: 'profile_support',  label: tr => tr.profiles },
  ],
  psu: [
    { key: 'manufacturer',     label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'wattage',          label: tr => tr.wattage },
    { key: 'form_factor',      label: tr => tr.formFactor },
    { key: 'efficiency_rating',label: tr => tr.efficiency },
    { key: 'modular',          label: tr => tr.modular },
    { key: 'length_mm',        label: tr => tr.length },
    { key: 'fanless',          label: tr => tr.fanless },
    { key: 'conn_atx_24pin',   label: tr => tr.atx24 },
    { key: 'conn_eps_8pin',    label: tr => tr.eps8 },
    { key: 'conn_pcie_6p2pin', label: tr => tr.pcie62 },
    { key: 'conn_sata',        label: tr => tr.sataConn },
  ],
  storage: [
    { key: 'manufacturer',  label: tr => tr.cpu === 'Процесори' ? 'Виробник' : 'Manufacturer' },
    { key: 'storage_type',  label: tr => tr.storageType },
    { key: 'form_factor',   label: tr => tr.formFactor },
    { key: 'interface',     label: tr => tr.interface },
    { key: 'capacity_gb',   label: tr => tr.capacity },
    { key: 'nvme',          label: tr => tr.nvme },
    { key: 'read_speed_mbs',label: tr => tr.readSpeed },
    { key: 'write_speed_mbs',label: tr => tr.writeSpeed },
    { key: 'cache_mb',      label: tr => tr.cache },
    { key: 'rpm',           label: tr => tr.rpm },
  ],
}

export default function Compare({ entries, onRemove, onClear, onViewPart, tr }: Props) {
  // Group entries by category
  const categories = [...new Set(entries.map(e => e.category))] as Category[]
  const [activeTab, setActiveTab] = useState<Category | null>(() => categories[0] ?? null)
  const [diffOnly, setDiffOnly] = useState(false)

  if (entries.length === 0) {
    return (
      <div className="compare-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
        <p>{tr.compareEmpty}</p>
        <span className="compare-hint">{tr.compareOneCat}</span>
      </div>
    )
  }

  const currentCat = activeTab ?? categories[0]
  const tabEntries = entries.filter(e => e.category === currentCat)
  const fields = FIELDS[currentCat] ?? []

  const activeFields = fields.filter(f =>
    tabEntries.some(e => {
      const v = formatValue((e.part as Record<string, unknown>)[f.key])
      return v && v !== '—'
    })
  )

  const visibleFields = diffOnly
    ? activeFields.filter(f => {
        const vals = tabEntries.map(e => formatValue((e.part as Record<string, unknown>)[f.key]))
        return new Set(vals).size > 1
      })
    : activeFields

  return (
    <div className="compare">
      {/* Header */}
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

      {/* Category tabs — only shown when multiple categories */}
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

      {/* Table */}
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-th-label"></th>
              {tabEntries.map(e => (
                <th key={e.part.opendb_id} className="compare-th-part">
                  <div className="compare-part-head">
                    <button className="compare-part-name" onClick={() => onViewPart(e.part, e.category)}>
                      {e.part.name}
                    </button>
                    <span className="compare-part-mfr">{e.part.manufacturer}</span>
                    <button className="compare-remove-btn" onClick={() => onRemove(e.part.opendb_id)} title={tr.compareRemove}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFields.map(field => {
              const vals = tabEntries.map(e => formatValue((e.part as Record<string, unknown>)[field.key]))
              const isDiff = new Set(vals).size > 1
              return (
                <tr key={field.key} className={isDiff ? 'compare-row-diff' : ''}>
                  <td className="compare-td-label">{field.label(tr)}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`compare-td-val${isDiff ? ' diff' : ''}`}>{v}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Info if mixed categories */}
      {categories.length > 1 && (
        <p className="compare-mixed-note">{tr.compareOneCat}</p>
      )}
    </div>
  )
}