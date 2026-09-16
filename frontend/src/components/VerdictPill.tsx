import { Ban, CircleSlash, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Verdict } from '../types/sentry'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function verdictLabel(verdict: string): string {
  return verdict === 'CHECK_FAILED' ? 'CHECK FAILED' : verdict
}

const pillClass: Record<string, string> = {
  STOP: 'border-destructive/40 bg-destructive/10 text-destructive',
  CAUTION: 'border-warning/40 bg-warning/15 text-warning',
  SAFE: 'border-success/40 bg-success/10 text-success',
  CHECK_FAILED: 'border-border bg-muted text-muted-foreground',
}

const pillIcon: Record<string, LucideIcon> = {
  STOP: Ban,
  CAUTION: TriangleAlert,
  SAFE: ShieldCheck,
  CHECK_FAILED: CircleSlash,
}

export function VerdictPill({ verdict }: { verdict: string }) {
  const Icon = pillIcon[verdict] ?? CircleSlash
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 min-w-[4.75rem] justify-center gap-1 rounded-full border px-2.5 py-0 text-[11px] font-normal leading-none',
        '[&>svg]:size-3!',
        pillClass[verdict] ?? pillClass.CHECK_FAILED,
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden />
      <span className="uppercase tracking-wide">
        {verdict === 'CHECK_FAILED' ? 'Failed' : verdict}
      </span>
    </Badge>
  )
}

export function verdictTone(verdict: Verdict | string): string {
  return pillClass[verdict] ?? pillClass.CHECK_FAILED
}
