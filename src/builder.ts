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

// Get spec value from part's _specs (enricher data) or typed field
function getSpec(part: Part, ...keys: string[]): string | undefined {
  const specs = (part as any)._specs as Record<string, string> | undefined
  for (const k of keys) {
    const v = specs?.[k] ?? (part as any)[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return undefined
}

export function getPickFilters(slot: BuildSlot, build: Build): Record<string, string | number> {
  const filters: Record<string, string | number> = {}
  const cpu = build.cpu?.part
  const mb  = build.motherboard?.part

  switch (slot) {
    case 'motherboard':
      if (cpu) {
        // CPU has "Тип роз'єму": "Socket 1700"
        // Motherboard has "Сокет": "Socket AM4"
        const cpuSocket = getSpec(cpu, "Тип роз'єму", 'Сокет', 'socket')
        if (cpuSocket) { filters['Сокет'] = cpuSocket; console.log('[Builder] MB filter socket =', cpuSocket) }
      }
      break

    case 'cpu':
      if (mb) {
        // Motherboard has "Сокет": "Socket AM4"
        const mbSocket = getSpec(mb, 'Сокет', 'socket')
        if (mbSocket) { filters["Тип роз'єму"] = mbSocket; console.log('[Builder] CPU filter socket =', mbSocket) }
      }
      break

    case 'ram':
      if (mb) {
        // MB has "Підтримка пам'яті": "4 x DDR4 DIMM; ..."
        // RAM has "Тип пам'яті": "DDR5 SDRAM" or "DDR4"
        const support = getSpec(mb, "Підтримка пам'яті", 'ram_type')
        const norm = support ? normalizeRamType(support) : undefined
        if (norm) {
          filters["Тип пам'яті"] = norm
          console.log('[Builder] RAM filter type =', norm)
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
    case 'motherboard': {
      const socket = getSpec(cpu ?? {} as Part, "Тип роз'єму", 'Сокет', 'socket')
      if (cpu && socket) return `Фільтр по сокету CPU: ${socket}`
      break
    }
    case 'cpu': {
      const socket = getSpec(mb ?? {} as Part, 'Сокет', 'socket')
      if (mb && socket) return `Фільтр по сокету материнської: ${socket}`
      break
    }
    case 'ram': {
      const support = getSpec(mb ?? {} as Part, "Підтримка пам'яті", 'ram_type')
      const norm = support ? normalizeRamType(support) : undefined
      if (mb && norm) return `Фільтр по типу RAM: ${norm}`
      break
    }
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