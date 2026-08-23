import { FraudCheck, displayAgentName, formatCheckTime } from '../types/sentry'
import { VerdictPill } from './VerdictPill'

export function FraudPopupCard({
  check,
  narration,
  agentLabel,
}: {
  check: FraudCheck
  narration?: string
  agentLabel?: string
}) {
  const text = narration === '' ? null : (narration ?? check.narration)
  const agent = displayAgentName(check.agent_name || agentLabel)

  return (
    <div style={{ padding: '17px 17px 6px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 13,
          paddingBottom: 13,
          borderBottom: '1px solid var(--line)',
          paddingRight: 18,
        }}
      >
        <span className="mono" style={{ fontWeight: 500, fontSize: 13 }}>{check.phone_number}</span>
        <VerdictPill verdict={check.verdict} />
      </div>
      <p className="hint" style={{ margin: '0 0 15px' }}>{text ?? 'Narration unavailable.'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Agent', value: agent },
          { label: 'Booth', value: check.agent_location },
          { label: 'Checked', value: formatCheckTime(check.checked_at) },
        ].map(row => (
          <div key={row.label}>
            <div className="metric-label">{row.label}</div>
            <div style={{ fontSize: 13, fontWeight: 550, marginTop: 3 }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
