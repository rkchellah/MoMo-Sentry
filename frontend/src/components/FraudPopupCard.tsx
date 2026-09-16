import { FraudCheck, displayAgentName, formatCheckTime } from '../types/sentry'
import { VerdictPill } from './VerdictPill'
import { Separator } from '@/components/ui/separator'

export function FraudPopupCard({
  check,
  narration,
  agentLabel,
  checkCount,
  onOpenQueue,
}: {
  check: FraudCheck
  narration?: string
  agentLabel?: string
  checkCount?: number
  onOpenQueue?: () => void
}) {
  const text = narration === '' ? null : (narration ?? check.narration)
  const agent = displayAgentName(check.agent_name || agentLabel)
  const booth = check.agent_location?.trim() || '-'
  const count = checkCount ?? 1

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))] font-sans text-sm font-normal text-card-foreground">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-4 pr-10">
        <p className="font-mono text-sm font-normal tracking-tight text-foreground">
          {check.phone_number}
        </p>
        <VerdictPill verdict={check.verdict} />
      </div>

      <div className="space-y-3 px-4 py-3">
        <p className="text-sm font-normal leading-relaxed text-muted-foreground">
          {text ?? 'Narration unavailable.'}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Meta label="Agent" value={agent} />
          <Meta label="Booth" value={booth} />
          <Meta label="Checked" value={formatCheckTime(check.checked_at)} />
        </div>

        <p className="text-xs font-normal text-muted-foreground">
          {count} {count === 1 ? 'check' : 'checks'} at this booth. Same rows as the Queue.
        </p>
      </div>

      {onOpenQueue ? (
        <>
          <Separator />
          <div className="px-4 py-2.5">
            <button
              type="button"
              onClick={onOpenQueue}
              className="text-sm font-normal text-foreground underline-offset-4 hover:underline"
            >
              Open in queue
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-normal text-foreground">{value}</p>
    </div>
  )
}
