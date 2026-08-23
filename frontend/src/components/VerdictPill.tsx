import { Verdict } from '../types/sentry'

export function verdictLabel(verdict: string): string {
  return verdict === 'CHECK_FAILED' ? 'CHECK FAILED' : verdict
}

const pillClass: Record<string, string> = {
  STOP: 'pill pill-stop',
  CAUTION: 'pill pill-caution',
  SAFE: 'pill pill-safe',
  CHECK_FAILED: 'pill pill-failed',
}

export function VerdictPill({ verdict }: { verdict: string }) {
  return (
    <span className={pillClass[verdict] ?? 'pill pill-failed'}>
      {verdict === 'CHECK_FAILED' ? 'FAILED' : verdict}
    </span>
  )
}

export function verdictTone(verdict: Verdict | string): string {
  return pillClass[verdict] ?? 'pill pill-failed'
}
