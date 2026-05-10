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
export function getPickFilters(slot: BuildSlot, build: Build): Record<string, string | number> {
  const filters: Record<string, string | number> = {}
  const cpu = build.cpu?.part
  const mb  = build.motherboard?.part

  switch (slot) {
    case 'motherboard':
      // Filter by CPU socket
      if (cpu?.socket) filters.socket = cpu.socket
      break

    case 'cpu':
      // Filter by motherboard socket
      if (mb?.socket) filters.socket = mb.socket
      break

    case 'ram':
      // Filter by motherboard RAM type
      if (mb?.ram_type) {
        const rt = (mb.ram_type as string).toUpperCase()
        // ram_type field in RAM table is e.g. "DDR5", "DDR4"
        filters.ram_type = rt.includes('DDR5') ? 'DDR5' : rt.includes('DDR4') ? 'DDR4' : rt
      }
      break

    case 'gpu':
      // No hard filter — GPUs are universal (PCIe)
      break

    case 'psu':
      // No hard filter — wattage guidance only (shown as hint)
      break

    case 'storage':
      // No hard filter — show all
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