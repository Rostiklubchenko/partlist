export type Category = 'cpu' | 'gpu' | 'motherboard' | 'ram' | 'psu' | 'storage'

export interface Part {
  opendb_id: string
  name: string
  manufacturer: string
  series?: string
  part_numbers?: string   // JSON array string
  // cpu
  socket?: string
  total_cores?: number
  boost_clock_ghz?: number
  tdp_w?: number
  integrated_graphics?: string
  // gpu
  chipset?: string
  memory_gb?: number
  memory_type?: string
  length_mm?: number
  // motherboard
  form_factor?: string
  chipset_str?: string
  ram_type?: string
  // ram
  speed_mhz?: number
  total_capacity_gb?: number
  // psu
  wattage?: number
  efficiency_rating?: string
  modular?: string
  // storage
  storage_type?: string
  interface?: string
  capacity_gb?: number
  read_speed_mbs?: number
  [key: string]: unknown
}

export interface RozetkaResult {
  url: string
  title: string
  price: string
  image: string
  rating: string
  reviews_count: string
}

export interface ShopEntry {
  shop_name: string
  price: string
  shop_url: string
}

export interface ShopsResult {
  url: string
  photos: string[]
  total_shops: number
  shops: ShopEntry[]
}

export interface SearxResult {
  url: string
  title: string
  content: string
}