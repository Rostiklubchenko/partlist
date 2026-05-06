import type { Category } from './types'

// ── Filter field definitions per category ─────────────────────────────────────
export interface FilterField {
  key: string           // API query param name
  label: string         // display label key in translations (or fallback)
  type: 'select' | 'range'
  // For range:
  min?: number; max?: number; step?: number; unit?: string
}

export type ActiveFilters = Record<string, string | number>

// Static filter configs per category
export const FILTER_CONFIGS: Record<Category, FilterField[]> = {
  cpu: [
    { key: 'manufacturer', label: 'Виробник / Manufacturer', type: 'select' },
    { key: 'socket',       label: 'Сокет / Socket',          type: 'select' },
    { key: 'cores_min',   label: 'Ядра від / Cores min',     type: 'range', min: 1, max: 64, step: 1 },
    { key: 'tdp_max',     label: 'TDP до / TDP max',         type: 'range', min: 10, max: 350, step: 5, unit: 'W' },
  ],
  gpu: [
    { key: 'manufacturer',         label: 'Виробник / Manufacturer',   type: 'select' },
    { key: 'chipset_manufacturer', label: 'Чіп / Chip maker',          type: 'select' },
    { key: 'memory_type',          label: 'Тип памʼяті / Memory type', type: 'select' },
    { key: 'memory_gb_min',        label: 'VRAM від / VRAM min',       type: 'range', min: 2, max: 48, step: 2, unit: 'GB' },
    { key: 'tdp_max',              label: 'TDP до / TDP max',          type: 'range', min: 50, max: 600, step: 25, unit: 'W' },
    { key: 'length_max_mm',        label: 'Довжина до / Length max',   type: 'range', min: 100, max: 400, step: 10, unit: 'mm' },
  ],
  motherboard: [
    { key: 'manufacturer', label: 'Виробник / Manufacturer', type: 'select' },
    { key: 'socket',       label: 'Сокет / Socket',          type: 'select' },
    { key: 'chipset',      label: 'Чіпсет / Chipset',        type: 'select' },
    { key: 'form_factor',  label: 'Форм-фактор / Form factor', type: 'select' },
    { key: 'ram_type',     label: 'Тип RAM / RAM type',      type: 'select' },
    { key: 'wifi',         label: 'Wi-Fi',                   type: 'select' },
  ],
  ram: [
    { key: 'manufacturer', label: 'Виробник / Manufacturer', type: 'select' },
    { key: 'ram_type',     label: 'Тип / Type',              type: 'select' },
    { key: 'speed_min',    label: 'Частота від / Speed min', type: 'range', min: 1600, max: 8000, step: 400, unit: 'MHz' },
    { key: 'capacity_gb',  label: 'Обʼєм / Capacity',       type: 'select' },
    { key: 'rgb',          label: 'RGB',                     type: 'select' },
  ],
  psu: [
    { key: 'manufacturer',      label: 'Виробник / Manufacturer',   type: 'select' },
    { key: 'efficiency_rating', label: 'Ефективність / Efficiency', type: 'select' },
    { key: 'modular',           label: 'Модульний / Modular',       type: 'select' },
    { key: 'wattage_min',       label: 'Потужність від / Watt min', type: 'range', min: 250, max: 2000, step: 50, unit: 'W' },
    { key: 'wattage_max',       label: 'Потужність до / Watt max',  type: 'range', min: 250, max: 2000, step: 50, unit: 'W' },
  ],
  storage: [
    { key: 'manufacturer',  label: 'Виробник / Manufacturer', type: 'select' },
    { key: 'storage_type',  label: 'Тип / Type',              type: 'select' },
    { key: 'interface',     label: 'Інтерфейс / Interface',   type: 'select' },
    { key: 'nvme',          label: 'NVMe',                    type: 'select' },
    { key: 'capacity_min',  label: 'Обʼєм від / Capacity min', type: 'range', min: 64, max: 20000, step: 64, unit: 'GB' },
    { key: 'capacity_max',  label: 'Обʼєм до / Capacity max', type: 'range', min: 64, max: 20000, step: 64, unit: 'GB' },
  ],
}

// Special select values for boolean/enum fields
export const FIXED_OPTIONS: Record<string, { value: string; label: string }[]> = {
  wifi:  [{ value: '1', label: 'Yes / Так' }, { value: '0', label: 'No / Ні' }],
  rgb:   [{ value: '1', label: 'Yes / Так' }, { value: '0', label: 'No / Ні' }],
  nvme:  [{ value: '1', label: 'Yes / Так' }, { value: '0', label: 'No / Ні' }],
  modular: [
    { value: 'Full', label: 'Full' },
    { value: 'Semi', label: 'Semi' },
    { value: 'Non-Modular', label: 'Non-Modular' },
  ],
}

// Fetch distinct values for a select filter from the API
export async function fetchFilterOptions(
  category: Category,
  field: string,
  apiBase: string
): Promise<string[]> {
  // Fields that have fixed options — no need to fetch
  if (FIXED_OPTIONS[field]) return []

  try {
    // Fetch a larger sample to get distinct values
    const res = await fetch(`${apiBase}/${category}?limit=200&offset=0`)
    if (!res.ok) return []
    const data: Record<string, unknown>[] = await res.json()

    // Map API param names back to DB column names
    const colMap: Record<string, string> = {
      chipset_manufacturer: 'chipset_manufacturer',
      memory_type: 'memory_type',
      form_factor: 'form_factor',
      ram_type: 'ram_type',
      efficiency_rating: 'efficiency_rating',
      storage_type: 'storage_type',
      capacity_gb: 'total_capacity_gb',
    }
    const col = colMap[field] ?? field

    const values = [...new Set(
      data.map(p => p[col]).filter(v => v != null && v !== '')
    )].map(String).sort()

    return values
  } catch { return [] }
}