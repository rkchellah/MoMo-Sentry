import React from 'react'

interface IconProps {
  size?: number
  color?: string
  className?: string
}

export function IconEye({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12C4 7 8 4 12 4C16 4 20 7 22 12C20 17 16 20 12 20C8 20 4 17 2 12Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
    </svg>
  )
}

export function IconEyeOff({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l18 18" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M2 12C4 7 8 4 12 4c1.2 0 2.4.3 3.5.8M22 12c-2 5-6 8-10 8-1.4 0-2.7-.3-3.9-1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSun({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.7" />
      <path
        d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconMoon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconArrow({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconAlert({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flex: 'none', marginTop: 1 }}>
      <circle cx="8" cy="8" r="6.6" stroke={color} strokeWidth="1.4" />
      <path d="M8 4.8v3.6M8 10.9v.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconInbox({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 13h4l1.6 2.6h6.8L17 13h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function IconPin({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 14.5s5-4.2 5-7.8A5 5 0 0 0 3 6.7c0 3.6 5 7.8 5 7.8Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="6.7" r="1.8" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function IconSearch({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconRefresh({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V5h-2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconEnter({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.4" y="1.4" width="13.2" height="13.2" rx="2.4" stroke={color} strokeWidth="1.25" />
      <path d="M10.2 5.2v3.2H5.6" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
      <path d="M7.1 6.7 5.5 8.4l1.6 1.7" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BrandLockup({ invert = false }: { invert?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-copy">
        <div className={`brand-kicker${invert ? ' is-invert' : ''}`}>Fraud checks</div>
        <div className="brand-name">MoMo Sentry</div>
      </div>
    </div>
  )
}
