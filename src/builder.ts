import type { Part, Category } from './types'

const KEY = 'partlist_build'

export type BuildSlot = Category
export interface BuildEntry { part: Part; category: Category; cachedPrice?: string }
export type Build = Partial<Record<BuildSlot, BuildEntry>>

const SLOTS: BuildSlot[] = ['cpu', 'motherboard', 'ram', 'gpu', 'psu', 'storage']
export { SLOTS }

function load(): Build { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }
function save(b: Build) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); window.dispatchEvent(new CustomEvent('build-updated')) } catch {}
}

export function getBuild(): Build { return load() }
export function setBuildPart(category: BuildSlot, part: Part, cachedPrice?: string) {
  const b = load(); b[category] = { part, category, cachedPrice }; save(b)
}
export function removeBuildPart(category: BuildSlot) { const b = load(); delete b[category]; save(b) }
export function clearBuild() { save({}) }
export function buildCount(): number { return Object.keys(load()).length }

export function getCompatHints(build: Build): string[] {
  const hints: string[] = []
  const cpu = build.cpu?.part; const mb = build.motherboard?.part; const ram = build.ram?.part
  if (cpu && mb) {
    const cs = (cpu.socket ?? '').toUpperCase(); const ms = (mb.socket ?? '').toUpperCase()
    if (cs && ms && cs !== ms) hints.push(`CPU сокет ${cs} ≠ Motherboard сокет ${ms}`)
  }
  if (mb && ram) {
    const mr = (mb.ram_type as string ?? '').toUpperCase(); const rt = (ram.ram_type as string ?? '').toUpperCase()
    if (mr && rt && !mr.includes(rt) && !rt.includes(mr)) hints.push(`Motherboard підтримує ${mr}, RAM — ${rt}`)
  }
  return hints
}

// ── Smart pre-filters based on current build ──────────────────────────────────
// Returns API query params to pre-filter a slot based on other chosen parts
// Extract base RAM type — "DDR5-6000" → "DDR5"
function normalizeRamType(s: string): string {
  const m = s.match(/DDR\d/i)
  return m ? m[0].toUpperCase() : s.trim()
}

export function getPickFilters(slot: BuildSlot, build: Build): Record<string, string | number> {
  const filters: Record<string, string | number> = {}
  const cpu = build.cpu?.part
  const mb  = build.motherboard?.part

  switch (slot) {
    case 'motherboard':
      if (cpu?.socket) {
        filters.socket = String(cpu.socket).trim()
        console.log('[Builder] Motherboard filter: socket =', filters.socket)
      }
      break

    case 'cpu':
      if (mb?.socket) {
        filters.socket = String(mb.socket).trim()
        console.log('[Builder] CPU filter: socket =', filters.socket)
      }
      break

    case 'ram':
      if (mb?.ram_type) {
        filters.ram_type = normalizeRamType(String(mb.ram_type))
        console.log('[Builder] RAM filter: ram_type =', filters.ram_type)
      } else if (cpu) {
        // Fallback: guess from CPU generation
        // Alder/Raptor Lake → DDR4/DDR5, Zen4 → DDR5
        const arch = String(cpu.microarchitecture ?? '').toLowerCase()
        if (arch.includes('zen 4') || arch.includes('zen4') || arch.includes('raptor')) {
          // no safe assumption — don't filter
        }
      }
      break

    case 'gpu':
    case 'psu':
    case 'storage':
      break
  }

  return filters
}

// Human-readable description of why the filter was applied
export function getFilterReason(slot: BuildSlot, build: Build): string | null {
  const cpu = build.cpu?.part
  const mb  = build.motherboard?.part

  switch (slot) {
    case 'motherboard':
      if (cpu?.socket) return `Filtered by CPU socket: ${cpu.socket}`
      break
    case 'cpu':
      if (mb?.socket) return `Filtered by Motherboard socket: ${mb.socket}`
      break
    case 'ram':
      if (mb?.ram_type) return `Filtered by Motherboard RAM type: ${mb.ram_type}`
      break
  }
  return null
}

// Get cached Rozetka price for a part
export function getCachedPrice(opendb_id: string): string | null {
  try {
    const raw = localStorage.getItem(`partlist_price_${opendb_id}`)
    if (!raw) return null
    const entry = JSON.parse(raw)
    // 6h TTL check
    if (Date.now() - entry.ts > 6 * 60 * 60 * 1000) return null
    return entry.data?.price ?? null
  } catch { return null }
}