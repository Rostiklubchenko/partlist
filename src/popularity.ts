/**
 * Popularity store — повністю локальний, без API запитів.
 *
 * Три джерела даних:
 * 1. clicks      — скільки разів юзер відкривав цей товар (миттєво)
 * 2. rozetka     — rating + reviews_count, зберігається ПАСИВНО коли
 *                  Rozetka вже спарсилась (не коштує жодного API запиту)
 * 3. score       — зважений фінальний скор для сортування
 *
 * Score formula:
 *   score = clicks * 2
 *         + reviews_count * 0.01          (кожні 100 відгуків = +1 бал)
 *         + rating * 10                   (5 зірок = +50 балів)
 *
 * Дані накопичуються пасивно і зберігаються між сесіями.
 */

const KEY = 'partlist_pop'

export interface PopEntry {
  clicks: number
  rating?: number
  reviews?: number
  score: number
  ts: number  // last updated
}

type PopStore = Record<string, PopEntry>

function load(): PopStore {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function save(store: PopStore) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch {}
}

function calcScore(e: Omit<PopEntry, 'score' | 'ts'>): number {
  return (
    (e.clicks ?? 0) * 2 +
    (e.reviews ?? 0) * 0.01 +
    (e.rating ?? 0) * 10
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call when user clicks on a part card */
export function trackClick(id: string) {
  const store = load()
  const prev = store[id] ?? { clicks: 0, score: 0, ts: 0 }
  const updated = { ...prev, clicks: prev.clicks + 1, ts: Date.now() }
  updated.score = calcScore(updated)
  store[id] = updated
  save(store)
}

/** Call passively after Rozetka parse completes — no extra API cost */
export function trackRozetkaData(id: string, rating: number, reviews: number) {
  const store = load()
  const prev = store[id] ?? { clicks: 0, score: 0, ts: 0 }
  const updated = { ...prev, rating, reviews, ts: Date.now() }
  updated.score = calcScore(updated)
  store[id] = updated
  save(store)
}

/** Get score for a single part */
export function getScore(id: string): number {
  return load()[id]?.score ?? 0
}

/** Get full entry for a part */
export function getEntry(id: string): PopEntry | null {
  return load()[id] ?? null
}

/**
 * Sort a list of parts by popularity score (desc).
 * Parts with no data go to the end, ordered by name.
 */
export function sortByPopularity<T extends { opendb_id: string; name: string }>(parts: T[]): T[] {
  const store = load()
  return [...parts].sort((a, b) => {
    const sa = store[a.opendb_id]?.score ?? -1
    const sb = store[b.opendb_id]?.score ?? -1
    if (sa !== sb) return sb - sa
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

/** How many parts have popularity data */
export function statsCount(): number {
  return Object.keys(load()).length
}

/** Top N most popular part ids */
export function topIds(n = 10): string[] {
  const store = load()
  return Object.entries(store)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, n)
    .map(([id]) => id)
}