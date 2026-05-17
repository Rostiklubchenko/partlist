import type { Category, Part, RozetkaResult, ShopsResult } from '../types'

const ENRICHER = '/api/enricher'
const SHOPS_API = '/api/shops'
const SERPAPI_KEY = (import.meta as any).env?.VITE_SERPAPI_KEY ?? ''

// ── Category mapping: frontend → enricher ────────────────────────────────────
const CAT_MAP: Record<Category, string> = {
  cpu:         'processors',
  gpu:         'videocards',
  motherboard: 'motherboards',
  ram:         'memory',
  psu:         'psu',
  storage:     'ssd',
}
const CAT_REVERSE: Record<string, Category> = Object.fromEntries(
  Object.entries(CAT_MAP).map(([k, v]) => [v, k as Category])
)

// ── Enricher product → Part ───────────────────────────────────────────────────
function enricherToPart(p: EnricherProduct, category: Category): Part {
  const specs = p.specs ?? {}

  // Map common spec fields from characteristics dict
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = specs[k] ?? specs[k.toLowerCase()]
      if (v) return String(v)
    }
    return undefined
  }

  return {
    opendb_id:    p.opendb_id,
    _position:    p.position,
    name:         p.name ?? '',
    manufacturer: get('Бренд', 'Виробник', 'Brand', 'Manufacturer') ?? p.name?.split(' ')[0] ?? '',
    series:       get('Серія', 'Series'),
    _rozetka_url: p.url,
    _image_url:   p.image_url,
    _price_uah:   p.price_uah ?? undefined,
    _rating:      p.rating ?? undefined,
    _reviews:     p.reviews ?? undefined,
    _enriched:    !!p.enriched_at,
    _specs:       specs,
    // CPU
    socket:               get('Сокет', 'Socket'),
    microarchitecture:    get('Мікроархітектура', 'Архітектура', 'Microarchitecture'),
    total_cores:          Number(get('Кількість ядер', 'Cores')) || undefined,
    threads:              Number(get('Кількість потоків', 'Threads')) || undefined,
    base_clock_ghz:       parseFloat(get('Базова тактова частота', 'Base clock') ?? '') || undefined,
    boost_clock_ghz:      parseFloat(get('Максимальна частота', 'Max boost clock', 'Boost clock') ?? '') || undefined,
    l3_cache_mb:          parseFloat(get('Кеш L3', 'L3 cache') ?? '') || undefined,
    tdp_w:                Number(get('TDP', 'Тепловиділення') ?? '') || undefined,
    integrated_graphics:  get('Інтегрована відеокарта', 'Integrated graphics'),
    lithography:          get('Технологічний процес', 'Lithography'),
    memory_types:         get('Тип підтримуваної памяті', 'Memory type'),
    // GPU
    chipset:              get('Модель графічного процесора', 'GPU', 'Chip'),
    memory_gb:            Number(get('Обсяг відеопамяті', 'Memory size') ?? '') || undefined,
    memory_type:          get('Тип відеопамяті', 'Memory type'),
    core_base_clock_mhz:  Number(get('Базова частота GPU', 'Core clock') ?? '') || undefined,
    core_boost_clock_mhz: Number(get('Частота в режимі Boost', 'Boost clock') ?? '') || undefined,
    memory_bus_bit:       Number(get('Розрядність шини', 'Memory bus') ?? '') || undefined,
    total_slot_width:     get('Слоти розширення', 'Slot width'),
    // Motherboard
    form_factor:          get('Форм-фактор', 'Form factor'),
    ram_type:             get('Тип пам\'яті', 'Memory type', 'RAM type'),
    ram_slots:            Number(get('Кількість роз\'ємів пам\'яті', 'Memory slots') ?? '') || undefined,
    max_memory_gb:        Number(get('Максимальний обсяг пам\'яті', 'Max memory') ?? '') || undefined,
    sata_6gbs:            Number(get('SATA III', 'SATA 6Gb/s') ?? '') || undefined,
    m2_slots:             get('Слоти M.2', 'M.2 slots'),
    wifi:                 get('Wi-Fi', 'WiFi', 'Бездротовий зв\'язок'),
    bluetooth:            get('Bluetooth'),
    // RAM
    total_capacity_gb:    Number(get('Загальний обсяг', 'Capacity', 'Об\'єм') ?? '') || undefined,
    module_count:         Number(get('Кількість модулів', 'Modules') ?? '') || undefined,
    speed_mhz:            Number(get('Тактова частота', 'Speed', 'Frequency') ?? '') || undefined,
    cas_latency:          Number(get('Затримка CAS', 'CAS latency', 'CL') ?? '') || undefined,
    voltage_v:            parseFloat(get('Напруга живлення', 'Voltage') ?? '') || undefined,
    rgb:                  get('RGB підсвічування', 'RGB'),
    profile_support:      get('Профілі', 'Profiles', 'XMP'),
    // PSU
    wattage:              Number(get('Потужність', 'Wattage', 'Power') ?? '') || undefined,
    efficiency_rating:    get('Сертифікат 80 Plus', 'Efficiency', '80 Plus'),
    modular:              get('Підключення кабелів', 'Modular'),
    fanless:              get('Тихий режим', 'Fanless'),
    conn_atx_24pin:       get('ATX 24-pin'),
    conn_eps_8pin:        get('EPS/CPU 8-pin', 'EPS 8-pin'),
    conn_pcie_6p2pin:     get('PCIe 6+2-pin', 'PCIe power'),
    conn_sata:            get('SATA'),
    // Storage
    storage_type:         get('Тип', 'Type', 'Форм-фактор'),
    interface:            get('Інтерфейс', 'Interface'),
    capacity_gb:          Number(get('Ємність', 'Capacity') ?? '') || undefined,
    nvme:                 get('NVMe', 'Протокол'),
    read_speed_mbs:       Number(get('Швидкість читання', 'Read speed') ?? '') || undefined,
    write_speed_mbs:      Number(get('Швидкість запису', 'Write speed') ?? '') || undefined,
    cache_mb:             Number(get('Кеш', 'Cache') ?? '') || undefined,
    rpm:                  get('Швидкість обертання', 'RPM'),
  }
}

export interface EnricherProduct {
  opendb_id:   string
  position?:   number
  category:    string
  name:        string
  url:         string
  image_url:   string
  price_uah:   number | null
  old_price:   number | null
  rating:      number | null
  reviews:     number | null
  specs:       Record<string, string>
  enriched_at: string | null
  parsed_at:   string | null
}

// ── Main API functions ────────────────────────────────────────────────────────

export async function fetchParts(
  category: Category,
  params: Record<string, string | number> = {}
): Promise<Part[]> {
  const catName = CAT_MAP[category]
  const q = new URLSearchParams()

  if (params.limit) q.set('limit', String(params.limit))
  if (params.offset) q.set('offset', String(params.offset))
  if (params.name) q.set('name', String(params.name))
  if (params.min_price) q.set('min_price', String(params.min_price))
  if (params.max_price) q.set('max_price', String(params.max_price))
  if (params.sort && params.sort !== 'popular' && params.sort !== 'az_local') q.set('sort', String(params.sort))

  const res = await fetch(`${ENRICHER}/products/${catName}?${q}`)
  if (!res.ok) throw new Error(`Enricher ${res.status}`)
  const data = await res.json()
  return (data.products as EnricherProduct[]).map(p => enricherToPart(p, category))
}

export async function searchByPartNumber(partNumber: string): Promise<Part[]> {
  // Search across all categories by name match
  const results: Part[] = []
  for (const [cat, catName] of Object.entries(CAT_MAP)) {
    try {
      const res = await fetch(`${ENRICHER}/products/${catName}?name=${encodeURIComponent(partNumber)}&limit=10`)
      if (!res.ok) continue
      const data = await res.json()
      const parts = (data.products as EnricherProduct[]).map(p => enricherToPart(p, cat as Category))
      results.push(...parts)
    } catch { /* continue */ }
  }
  return results
}

export function isPartNumber(q: string): boolean {
  const clean = q.trim()
  return clean.length >= 4 && !/\s/.test(clean) && /\d/.test(clean) && /[A-Za-z]/.test(clean)
}

export function tokenize(q: string): string[] {
  const words = q.trim().split(/\s+/).filter(w => w.length >= 2)
  if (words.length <= 1) return words
  const variants: string[] = []
  for (let i = 0; i < Math.min(words.length, 3); i++) {
    variants.push(words.slice(i).join(' '))
  }
  return [...new Set(variants)]
}

// ── Rozetka via enricher (no SerpApi needed!) ─────────────────────────────────
export async function parseRozetka(url: string): Promise<RozetkaResult> {
  const q = new URLSearchParams({ url })
  const res = await fetch(`/api/rozetka/rozetka?${q}`)
  if (!res.ok) throw new Error(`Rozetka parser ${res.status}`)
  return res.json()
}

// ── Shops (hotline) — still uses SerpApi for URL, then parses ────────────────
export interface SerpResult {
  link: string
  title: string
  snippet?: string
  rich_snippet?: {
    bottom?: { detected_extensions?: { price?: number; price_from?: number; currency?: string } }
  }
}

export async function serpSearch(query: string): Promise<SerpResult[]> {
  if (!SERPAPI_KEY) throw new Error('VITE_SERPAPI_KEY is not set')
  const q = new URLSearchParams({ q: query, api_key: SERPAPI_KEY, engine: 'google', num: '10', gl: 'ua', hl: 'uk' })
  const res = await fetch(`/api/serpapi/search.json?${q}`)
  if (!res.ok) throw new Error(`SerpApi ${res.status}`)
  const data = await res.json()
  return data.organic_results ?? []
}

const ROZETKA_PRODUCT_RE  = /rozetka\.com\.ua\/.*\/p\d+\/?$/
const ROZETKA_CATEGORY_RE = /\/c\d+\/|;[0-9]+=|=[a-z]/
const SHOPS_PRODUCT_UA_RE  = /hotline\.ua\/ua\/[^/]+-[^/]+\/[^/]+-[^/]+\/?$/
const SHOPS_PRODUCT_ANY_RE = /hotline\.ua\/[^/]+-[^/]+\/[^/]+-[^/]+\/?$/
const SHOPS_BAD_RE = /\/fs\/\d+|\/c\d+\/|processory\/?$|\/computer\/?$/

export function findRozetkaUrl(results: SerpResult[]): string | null {
  const product = results.find(r => ROZETKA_PRODUCT_RE.test(r.link) && !ROZETKA_CATEGORY_RE.test(r.link))
  if (product) return product.link
  return results.find(r => ROZETKA_PRODUCT_RE.test(r.link))?.link ?? null
}

export function findShopsUrl(results: SerpResult[]): string | null {
  const best = results.find(r => SHOPS_PRODUCT_UA_RE.test(r.link) && !SHOPS_BAD_RE.test(r.link))
  if (best) return best.link
  return results.find(r => SHOPS_PRODUCT_ANY_RE.test(r.link) && !SHOPS_BAD_RE.test(r.link))?.link ?? null
}

export interface SerpPrice { price: string; url: string; title: string }
export function extractRozetkaPrice(results: SerpResult[]): SerpPrice | null {
  for (const r of results) {
    if (!ROZETKA_PRODUCT_RE.test(r.link)) continue
    const ext = r.rich_snippet?.bottom?.detected_extensions
    if (!ext) continue
    const amount = ext.price ?? ext.price_from
    if (!amount) continue
    const currency = ext.currency === 'UAH' ? '₴' : (ext.currency ?? '')
    return { price: `${amount.toLocaleString('uk-UA')} ${currency}`, url: r.link, title: r.title }
  }
  return null
}

export async function parseShops(url: string): Promise<ShopsResult> {
  const q = new URLSearchParams({ url })
  const res = await fetch(`${SHOPS_API}/shops?${q}`)
  if (!res.ok) throw new Error(`Shops parser ${res.status}`)
  return res.json()
}

export function getPartNumbers(part: Part): string[] {
  if (!part.part_numbers) return []
  try { return JSON.parse(part.part_numbers) } catch { return [] }
}

export function buildRozetkaQuery(part: Part): string {
  const pns = getPartNumbers(part)
  return `${pns[0] ?? part.name} site:rozetka.com.ua`
}

export function buildShopsQuery(part: Part): string {
  const pns = getPartNumbers(part)
  return `${pns[0] ?? part.name} site:hotline.ua`
}

export { serpSearch as searxSearch }