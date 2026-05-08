import type { Category, Part, RozetkaResult, ShopsResult } from '../types'

const BC  = '/api/buildcores'
const ROZ = '/api/rozetka'
const SHOPS_API = '/api/hotline'

const SERPAPI_KEY = import.meta.env.VITE_SERPAPI_KEY ?? ''

// ── BuildCores — fuzzy search ─────────────────────────────────────────────────
// Якщо юзер вводить part number або назву з помилками — пробуємо кілька стратегій:
// 1. name LIKE %query%  (стандарт)
// 2. part_number search через /part/{query}
// 3. Токенізований пошук — розбиваємо запит на слова і шукаємо по кожному
export async function fetchParts(
  category: Category,
  params: Record<string, string | number> = {}
): Promise<Part[]> {
  const q = new URLSearchParams({ limit: '40', ...Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  )})
  const res = await fetch(`${BC}/${category}?${q}`)
  if (!res.ok) throw new Error(`BuildCores ${res.status}`)
  return res.json()
}

// Пошук по part number — повертає результати з усіх таблиць
export async function searchByPartNumber(partNumber: string): Promise<Part[]> {
  const res = await fetch(`${BC}/part/${encodeURIComponent(partNumber)}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`BuildCores part search ${res.status}`)
  return res.json()
}

// Розумний пошук: визначає чи це part number (містить цифри + літери без пробілів)
// і якщо так — шукає по part_number, інакше — звичайний name пошук
export function isPartNumber(q: string): boolean {
  const clean = q.trim()
  // Part numbers: BX80684I58400, RTX4090-24G, CM8068403358811 — без пробілів, є цифри
  return clean.length >= 4 && !/\s/.test(clean) && /\d/.test(clean) && /[A-Za-z]/.test(clean)
}

// Токенізація для нечіткого пошуку
// "core i5 14400" → шукаємо "core i5 14400", потім "i5 14400", потім "14400"
export function tokenize(q: string): string[] {
  const words = q.trim().split(/\s+/).filter(w => w.length >= 2)
  if (words.length <= 1) return words
  // Повний запит + підзапити (без першого слова кожен раз)
  const variants: string[] = []
  for (let i = 0; i < Math.min(words.length, 3); i++) {
    variants.push(words.slice(i).join(' '))
  }
  return [...new Set(variants)]
}

// ── SerpApi ───────────────────────────────────────────────────────────────────
export interface SerpResult {
  link: string
  title: string
  snippet?: string
  rich_snippet?: {
    bottom?: {
      detected_extensions?: {
        price?: number
        price_from?: number
        currency?: string
      }
    }
  }
}

export async function serpSearch(query: string): Promise<SerpResult[]> {
  if (!SERPAPI_KEY) throw new Error('VITE_SERPAPI_KEY is not set')

  const q = new URLSearchParams({
    q: query,
    api_key: SERPAPI_KEY,
    engine: 'google',
    num: '10',
    gl: 'ua',
    hl: 'uk',
  })

  const res = await fetch(`/api/serpapi/search.json?${q}`)
  if (!res.ok) throw new Error(`SerpApi ${res.status}`)
  const data = await res.json()

  const results: SerpResult[] = data.organic_results ?? []
  console.log(`[SerpApi] "${query}" → ${results.length} results`)
  results.slice(0, 5).forEach((r, i) => console.log(`  [${i}] ${r.link}`))
  return results
}

// ── URL finders ───────────────────────────────────────────────────────────────
const ROZETKA_PRODUCT_RE  = /rozetka\.com\.ua\/.*\/p\d+\/?$/
const ROZETKA_CATEGORY_RE = /\/c\d+\/|;[0-9]+=|=[a-z]/

export function findRozetkaUrl(results: SerpResult[]): string | null {
  const product = results.find(r =>
    ROZETKA_PRODUCT_RE.test(r.link) && !ROZETKA_CATEGORY_RE.test(r.link)
  )
  if (product) return product.link
  const anyProduct = results.find(r => ROZETKA_PRODUCT_RE.test(r.link))
  return anyProduct?.link ?? null
}

// Shops page URL patterns:
//   hotline.ua/ua/computer-processory/intel-core-i5-14400f-bx8071514400f/  ✓
//   hotline.ua/computer-processory/intel-core-i5-14400f-bx8071514400f/     ✓
// NOT product (rejected):
//   hotline.ua/computer/processory/          ✗ category (no dashes, short)
//   hotline.ua/computer-processory/fs/1493/  ✗ filter page
const SHOPS_PRODUCT_UA_RE  = /hotline\.ua\/ua\/[^/]+-[^/]+\/[^/]+-[^/]+\/?$/
const SHOPS_PRODUCT_ANY_RE = /hotline\.ua\/[^/]+-[^/]+\/[^/]+-[^/]+\/?$/
const SHOPS_BAD_RE = /\/fs\/\d+|\/c\d+\/|processory\/?$|\/computer\/?$/

export function findShopsUrl(results: SerpResult[]): string | null {
  // 1. Best: /ua/<cat-with-dash>/<slug-with-dash>/
  const best = results.find(r =>
    SHOPS_PRODUCT_UA_RE.test(r.link) && !SHOPS_BAD_RE.test(r.link)
  )
  if (best) return best.link

  // 2. Without /ua/ prefix
  const good = results.find(r =>
    SHOPS_PRODUCT_ANY_RE.test(r.link) && !SHOPS_BAD_RE.test(r.link)
  )
  if (good) return good.link

  // NO fallback — better to return null than cache a category page
  return null
}

// ── Extract price from SerpApi rich_snippet ───────────────────────────────────
export interface SerpPrice { price: string; url: string; title: string }

export function extractRozetkaPrice(results: SerpResult[]): SerpPrice | null {
  for (const r of results) {
    if (!ROZETKA_PRODUCT_RE.test(r.link)) continue
    const ext = r.rich_snippet?.bottom?.detected_extensions
    if (!ext) continue
    const amount = ext.price ?? ext.price_from
    if (!amount) continue
    const currency = ext.currency === 'UAH' ? '₴' : (ext.currency ?? '')
    return {
      price: `${amount.toLocaleString('uk-UA')} ${currency}`,
      url: r.link, title: r.title,
    }
  }
  return null
}

// ── Parsers ───────────────────────────────────────────────────────────────────
export async function parseRozetka(url: string): Promise<RozetkaResult> {
  const q = new URLSearchParams({ url })
  const res = await fetch(`${ROZ}/rozetka?${q}`)
  if (!res.ok) throw new Error(`Rozetka parser ${res.status}`)
  return res.json()
}

export async function parseShops(url: string): Promise<ShopsResult> {
  const q = new URLSearchParams({ url })
  const res = await fetch(`${SHOPS_API}/hotline?${q}`)
  if (!res.ok) throw new Error(`Shops parser ${res.status}`)
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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