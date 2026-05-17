export type Category = 'cpu' | 'gpu' | 'motherboard' | 'ram' | 'psu' | 'storage'

export interface Part {
  opendb_id: string
  name: string
  manufacturer: string
  series?: string
  part_numbers?: string
  // Enricher fields
  _position?: number
  _rozetka_url?: string
  _image_url?: string
  _price_uah?: number
  _rating?: number
  _reviews?: number
  _enriched?: boolean
  _specs?: Record<string, string>
  // cpu
  socket?: string
  microarchitecture?: string
  total_cores?: number
  threads?: number
  base_clock_ghz?: number
  boost_clock_ghz?: number
  l3_cache_mb?: number
  tdp_w?: number
  integrated_graphics?: string
  lithography?: string
  memory_types?: string
  // gpu
  chipset?: string
  memory_gb?: number
  memory_type?: string
  core_base_clock_mhz?: number
  core_boost_clock_mhz?: number
  memory_bus_bit?: number
  length_mm?: number
  total_slot_width?: string
  interface?: string
  // motherboard
  form_factor?: string
  chipset_str?: string
  ram_type?: string
  ram_slots?: number
  max_memory_gb?: number
  sata_6gbs?: number
  m2_slots?: string
  wifi?: string
  bluetooth?: string
  // ram
  speed_mhz?: number
  total_capacity_gb?: number
  module_count?: number
  cas_latency?: number
  voltage_v?: number
  rgb?: string
  profile_support?: string
  // psu
  wattage?: number
  efficiency_rating?: string
  modular?: string
  fanless?: string
  conn_atx_24pin?: string
  conn_eps_8pin?: string
  conn_pcie_6p2pin?: string
  conn_sata?: string
  // storage
  storage_type?: string
  capacity_gb?: number
  nvme?: string
  read_speed_mbs?: number
  write_speed_mbs?: number
  cache_mb?: number
  rpm?: string
  [key: string]: unknown
}

export interface RozetkaResult {
  url: string
  title: string
  price: string
  image: string
  rating: string
  reviews_count: string
  characteristics?: Record<string, string>
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