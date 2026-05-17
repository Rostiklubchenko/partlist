import type { Category } from './types'

export interface FilterField {
  key: string
  label: string
  type: 'select' | 'range'
  min?: number; max?: number; step?: number; unit?: string
}

export type ActiveFilters = Record<string, string | number>

// Keys exactly as they appear in enricher specs JSON (from Rozetka)
export const FILTER_CONFIGS: Record<Category, FilterField[]> = {
  cpu: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Сокет',                             label: 'Сокет',          type: 'select' },
    { key: 'Кількість ядер',                    label: 'Ядра',           type: 'select' },
    { key: 'Мікроархітектура',                  label: 'Архітектура',    type: 'select' },
    { key: 'Тип підтримуваної пам\'яті',        label: 'Тип RAM',        type: 'select' },
  ],
  gpu: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Чіп (GPU)',                         label: 'GPU',            type: 'select' },
    { key: 'Тип відеопам\'яті',                label: 'Тип VRAM',       type: 'select' },
    { key: 'Обсяг відеопам\'яті',              label: 'VRAM',           type: 'select' },
  ],
  motherboard: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Сокет',                             label: 'Сокет',          type: 'select' },
    { key: 'Чипсет (Північний міст)',           label: 'Чіпсет',        type: 'select' },
    { key: 'Формфактор',                        label: 'Форм-фактор',    type: 'select' },
    { key: 'Підтримка пам\'яті',               label: 'Тип RAM',        type: 'select' },
    { key: 'Бездротовий інтерфейс',            label: 'Wi-Fi',          type: 'select' },
  ],
  ram: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Тип пам\'яті',                     label: 'Тип',            type: 'select' },
    { key: 'Обсяг пам\'яті',                   label: "Об'єм",          type: 'select' },
    { key: 'Частота пам\'яті',                 label: 'Частота',        type: 'select' },
    { key: 'RGB підсвічування',                 label: 'RGB',            type: 'select' },
  ],
  psu: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Потужність',                        label: 'Потужність',     type: 'select' },
    { key: 'Сертифікат 80 Plus',                label: 'Сертифікат',     type: 'select' },
    { key: 'Підключення кабелів',               label: 'Модульний',      type: 'select' },
  ],
  storage: [
    { key: 'Виробник',                          label: 'Виробник',       type: 'select' },
    { key: 'Тип',                               label: 'Тип',            type: 'select' },
    { key: 'Інтерфейс підключення',            label: 'Інтерфейс',      type: 'select' },
    { key: 'Ємність',                           label: "Ємність",        type: 'select' },
    { key: 'Підтримка NVMe',                    label: 'NVMe',           type: 'select' },
  ],
}

export const FIXED_OPTIONS: Record<string, { value: string; label: string }[]> = {}

const CAT_MAP: Record<Category, string> = {
  cpu: 'processors', gpu: 'videocards', motherboard: 'motherboards',
  ram: 'memory', psu: 'psu', storage: 'ssd',
}

export async function fetchFilterOptions(
  category: Category,
  specKey: string,
  _apiBase: string
): Promise<string[]> {
  try {
    const res = await fetch(`/api/enricher/specs_values/${CAT_MAP[category]}/${encodeURIComponent(specKey)}`)
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}