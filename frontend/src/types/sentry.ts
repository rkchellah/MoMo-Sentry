export type Verdict = 'SAFE' | 'CAUTION' | 'STOP' | 'CHECK_FAILED'

export interface FraudCheck {
    id: string
    phone_number: string
    verdict: Verdict
    score: number
    signals: string[]
    narration: string
    sim_swapped: boolean
    last_sim_change: string | null
    device_swapped: boolean
    last_device_change: string | null
    device_connectivity: string
    device_roaming: boolean
    agent_location: string
    checked_at: string
    agent_id?: string
    agent_name?: string | null
    // Resolved from agent_location via the booth_locations table
    latitude?: number
    longitude?: number
}

export interface FraudStats {
    safe: number
    caution: number
    stop: number
    failed: number
    total: number
}

export function computeFraudStats(checks: FraudCheck[]): FraudStats {
    const stats: FraudStats = { safe: 0, caution: 0, stop: 0, failed: 0, total: checks.length }
    for (const c of checks) {
        switch (c.verdict) {
            case 'SAFE': stats.safe++; break
            case 'CAUTION': stats.caution++; break
            case 'STOP': stats.stop++; break
            case 'CHECK_FAILED': stats.failed++; break
        }
    }
    return stats
}

export interface BoothLocation {
    name: string
    latitude: number
    longitude: number
}

// One dot on the map: a booth, coloured by its most recent check.
export interface MapPoint {
    id: string
    label: string      // agent name, or the number for an owner check
    sublabel: string   // booth location
    verdict: Verdict
    latitude: number
    longitude: number
    checkCount?: number
}

/** Which basemap the Where map draws. 'auto' follows the UI theme. */
export type BaseMap = 'auto' | 'light' | 'dark' | 'satellite'

export const BASEMAPS: { value: BaseMap; label: string }[] = [
    { value: 'auto', label: 'Match theme' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'satellite', label: 'Satellite' },
]

/** Class suffix for the greyscale verdict ramp used by dots and swatches. */
export const VERDICT_CLASS: Record<Verdict, string> = {
    'SAFE': 'v-safe',
    'CAUTION': 'v-caution',
    'STOP': 'v-stop',
    'CHECK_FAILED': 'v-failed',
}

export const VERDICT_RADIUS: Record<Verdict, number> = {
    'SAFE': 4,
    'CAUTION': 5,
    'STOP': 6,
    'CHECK_FAILED': 5,
}

// Deterministic offset so dots sharing a booth stay legible and stay put.
// Math.random() here made them jump on every 30s refresh.
export function jitterFor(seed: string, spread = 0.012): [number, number] {
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    const a = ((h >>> 0) % 10000) / 10000 - 0.5
    const b = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000 - 0.5
    return [a * spread, b * spread]
}

export function formatCheckTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${day} ${time}`
}

export function displayAgentName(name?: string | null): string {
    if (!name || name === 'Owner' || name === 'Owner check') return 'Lintel Zambia owner'
    return name
}
