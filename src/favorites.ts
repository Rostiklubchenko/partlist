import type { Part, Category } from './types'

const KEY = 'partlist_favs'

export interface FavEntry {
  part: Part
  category: Category
  addedAt: number
}

type FavStore = Record<string, FavEntry>

function load(): FavStore {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}
function save(s: FavStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    window.dispatchEvent(new CustomEvent('favs-updated', { detail: Object.keys(s).length }))
  } catch {}
}

export function addFav(part: Part, category: Category) {
  const s = load()
  s[part.opendb_id] = { part, category, addedAt: Date.now() }
  save(s)
}

export function removeFav(id: string) {
  const s = load()
  delete s[id]
  save(s)
}

export function toggleFav(part: Part, category: Category): boolean {
  if (isFav(part.opendb_id)) { removeFav(part.opendb_id); return false }
  else { addFav(part, category); return true }
}

export function isFav(id: string): boolean {
  return !!load()[id]
}

export function getAllFavs(): FavEntry[] {
  return Object.values(load()).sort((a, b) => b.addedAt - a.addedAt)
}

export function favsCount(): number {
  return Object.keys(load()).length
}