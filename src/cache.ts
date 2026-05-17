// ── Extended Cache ────────────────────────────────────────────────────────────
// Stores URLs, prices, and parsed data for parts
// TTL: 7 days for URLs, 6 hours for prices (prices change more often)

const PREFIX = 'partlist_url_'
const PRICE_PREFIX = 'partlist_price_'
const SHOPS_DATA_PREFIX = 'partlist_shops_'

const URL_TTL   = 7 * 24 * 60 * 60 * 1000   // 7 days
const PRICE_TTL = 6 * 60 * 60 * 1000         // 6 hours
const SHOPS_TTL = 4 * 60 * 60 * 1000         // 4 hours

interface CacheEntry<T> { data: T; ts: number }

function get<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > ttl) { localStorage.removeItem(key); return null }
    return entry.data
  } catch { return null }
}

function set<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function remove(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

// ── URL cache ─────────────────────────────────────────────────────────────────
export function cacheGet(id: string, type: 'rozetka' | 'shops'): string | null {
  return get<string>(`${PREFIX}${type}_${id}`, URL_TTL)
}
export function cacheSet(id: string, type: 'rozetka' | 'shops', url: string) {
  set(`${PREFIX}${type}_${id}`, url)
}
export function cacheInvalidate(id: string, type: 'rozetka' | 'shops') {
  remove(`${PREFIX}${type}_${id}`)
}

// ── Price cache (Rozetka) ─────────────────────────────────────────────────────
export interface CachedRozetkaData {
  price: string
  title: string
  image: string
  rating: string
  reviews_count: string
  url: string
  characteristics?: Record<string, string>
}

export function cacheGetRozetka(id: string): CachedRozetkaData | null {
  return get<CachedRozetkaData>(`${PRICE_PREFIX}${id}`, PRICE_TTL)
}
export function cacheSetRozetka(id: string, data: CachedRozetkaData) {
  set(`${PRICE_PREFIX}${id}`, data)
}

// ── Shops cache (price range + shop list) ─────────────────────────────────────
export interface CachedShopsData {
  minPrice: number
  maxPrice: number
  shopCount: number
  shops: { name: string; price: string; url: string }[]
  photos: string[]
}

export function cacheGetShops(id: string): CachedShopsData | null {
  return get<CachedShopsData>(`${SHOPS_DATA_PREFIX}${id}`, SHOPS_TTL)
}
export function cacheSetShops(id: string, data: CachedShopsData) {
  set(`${SHOPS_DATA_PREFIX}${id}`, data)
}

export function cacheStats(): { count: number } {
  const keys = Object.keys(localStorage).filter(k =>
    k.startsWith(PREFIX) || k.startsWith(PRICE_PREFIX) || k.startsWith(SHOPS_DATA_PREFIX)
  )
  return { count: keys.length }
}