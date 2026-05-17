import type { Category } from './types'

export interface FilterField {
  key: string
  label: string
  type: 'select' | 'range'
  min?: number; max?: number; step?: number; unit?: string
  // if true — extract manufacturer from product name instead of specs
  fromName?: boolean
}

export type ActiveFilters = Record<string, string | number>

export const FILTER_CONFIGS: Record<Category, FilterField[]> = {
  cpu: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: "Тип роз'єму",                      label: 'Сокет',         type: 'select' },
    { key: 'Кількість ядер',                   label: 'Ядра',          type: 'select' },
    { key: "Тип пам'яті",                      label: 'Тип RAM',       type: 'select' },
    { key: 'Техпроцес',                        label: 'Техпроцес',     type: 'select' },
  ],
  gpu: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: 'Графічний чип',                    label: 'GPU',           type: 'select' },
    { key: "Тип пам'яті",                      label: 'Тип VRAM',      type: 'select' },
    { key: "Обсяг пам'яті",                    label: 'VRAM',          type: 'select' },
    { key: 'Зайнятих слотів',                  label: 'Слоти',         type: 'select' },
  ],
  motherboard: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: 'Сокет',                            label: 'Сокет',         type: 'select' },
    { key: 'Чипсет (Північний міст)',          label: 'Чіпсет',        type: 'select' },
    { key: 'Формфактор',                       label: 'Форм-фактор',   type: 'select' },
    { key: "Підтримка пам'яті",               label: 'Тип RAM',        type: 'select' },
    { key: 'Бездротовий інтерфейс',            label: 'Wi-Fi',         type: 'select' },
  ],
  ram: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: "Тип пам'яті",                      label: 'Тип',           type: 'select' },
    { key: "Обсяг пам'яті",                    label: "Об'єм",         type: 'select' },
    { key: "Частота пам'яті",                  label: 'Частота',       type: 'select' },
    { key: 'Формфактор',                       label: 'Форм-фактор',   type: 'select' },
  ],
  psu: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: 'Потужність',                       label: 'Потужність',    type: 'select' },
    { key: 'Сертифікат 80 Plus',               label: 'Сертифікат',    type: 'select' },
    { key: 'Підключення кабелів',              label: 'Модульний',     type: 'select' },
    { key: 'Система охолодження',              label: 'Охолодження',   type: 'select' },
  ],
  storage: [
    { key: '_manufacturer',                    label: 'Виробник',      type: 'select', fromName: true },
    { key: 'Тип накопичувача',                 label: 'Тип',           type: 'select' },
    { key: 'Форм-фактор',                      label: 'Форм-фактор',   type: 'select' },
    { key: 'Інтерфейс підключення',           label: 'Інтерфейс',     type: 'select' },
    { key: "Обсяг/Об'єм",                      label: "Ємність",       type: 'select' },
  ],
}

export const FIXED_OPTIONS: Record<string, { value: string; label: string }[]> = {}

const CAT_MAP: Record<Category, string> = {
  cpu: 'processors', gpu: 'videocards', motherboard: 'motherboards',
  ram: 'memory', psu: 'psu', storage: 'ssd',
}

// Extract manufacturer brand from product name (first word)
// "Процесор Intel Core i5..." → "Intel"
// "Відеокарта ASUS PCI..." → "ASUS"
// "Матеинська плата Gigabyte..." → "Gigabyte"
export function extractManufacturer(name: string): string {
  // Skip leading category word (Процесор, Відеокарта, etc.)
  const words = name.trim().split(/\s+/)
  const categoryWords = ['Процесор', 'Відеокарта', 'Материнська', 'Блок', 'Оперативна', 'SSD', 'HDD', 'Жорсткий']
  let startIdx = 0
  if (categoryWords.some(w => words[0]?.startsWith(w))) {
    startIdx = words[0] === 'Материнська' || words[0] === 'Блок' || words[0] === 'Оперативна' ? 2 : 1
  }
  return words[startIdx] ?? words[0] ?? ''
}

export async function fetchFilterOptions(
  category: Category,
  specKey: string,
  _apiBase: string,
  allProducts?: { name: string; specs: Record<string, string> }[]
): Promise<string[]> {
  // fromName filter — extract from product names
  if (specKey === '_manufacturer') {
    if (allProducts) {
      const brands = new Set(allProducts.map(p => extractManufacturer(p.name)).filter(Boolean))
      return [...brands].sort()
    }
    // Fetch from enricher
    try {
      const res = await fetch(`/api/enricher/manufacturers/${CAT_MAP[category]}`)
      if (res.ok) return await res.json()
    } catch { /* fallback below */ }
    return []
  }
  try {
    const res = await fetch(`/api/enricher/specs_values/${CAT_MAP[category]}/${encodeURIComponent(specKey)}`)
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}