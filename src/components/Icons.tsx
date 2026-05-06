// Clean SVG icons — no emoji, consistent on all platforms
interface IconProps { size?: number; className?: string }

export function IconCPU({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  )
}

export function IconGPU({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="1" y="6" width="22" height="13" rx="2" />
      <path d="M6 6V4M10 6V4M14 6V4M18 6V4" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="12" r="2" />
      <path d="M11 12h2" />
    </svg>
  )
}

export function IconMotherboard({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <rect x="6" y="6" width="5" height="5" rx="1" />
      <rect x="13" y="6" width="5" height="3" rx="1" />
      <rect x="13" y="11" width="5" height="3" rx="1" />
      <path d="M6 14h5M6 17h5M13 17h5" />
      <path d="M4 9h2M4 12h2M4 15h2" />
    </svg>
  )
}

export function IconRAM({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 6V4M9 6V4M12 6V4M15 6V4M18 6V4" />
      <rect x="5" y="10" width="2" height="4" rx=".5" />
      <rect x="9" y="10" width="2" height="4" rx=".5" />
      <rect x="13" y="10" width="2" height="4" rx=".5" />
      <rect x="17" y="10" width="2" height="4" rx=".5" />
    </svg>
  )
}

export function IconPSU({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8" cy="12" r="2.5" />
      <path d="M13 9h5M13 12h5M13 15h3" />
    </svg>
  )
}

export function IconStorage({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="7" rx="1.5" />
      <rect x="2" y="13" width="20" height="7" rx="1.5" />
      <circle cx="18" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Arrow right — replaces → text
export function IconArrow({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

// Map category id to icon component
import type { Category } from '../types'

export function CategoryIcon({ id, size = 20, className }: { id: Category } & IconProps) {
  const props = { size, className }
  switch (id) {
    case 'cpu':         return <IconCPU {...props} />
    case 'gpu':         return <IconGPU {...props} />
    case 'motherboard': return <IconMotherboard {...props} />
    case 'ram':         return <IconRAM {...props} />
    case 'psu':         return <IconPSU {...props} />
    case 'storage':     return <IconStorage {...props} />
  }
}