// ── URL Cache ─────────────────────────────────────────────────────────────────
// Stores found Rozetka/Hotline URLs keyed by part opendb_id + type
// TTL: 7 days (links rarely change)

const CACHE_PREFIX = 'partlist_url_'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CacheEntry {
  url: string
  ts: number
}

export function cacheGet(id: string, type: 'rozetka' | 'hotline'): string | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${type}_${id}`)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${type}_${id}`)
      return null
    }
    return entry.url
  } catch { return null }
}

export function cacheSet(id: string, type: 'rozetka' | 'hotline', url: string) {
  try {
    const entry: CacheEntry = { url, ts: Date.now() }
    localStorage.setItem(`${CACHE_PREFIX}${type}_${id}`, JSON.stringify(entry))
  } catch {}
}

export function cacheInvalidate(id: string, type: 'rozetka' | 'hotline') {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${type}_${id}`)
  } catch {}
}

export function cacheStats(): { count: number; keys: string[] } {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
  return { count: keys.length, keys }
}