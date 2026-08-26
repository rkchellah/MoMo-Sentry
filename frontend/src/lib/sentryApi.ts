export const SANDBOX_CUSTOMERS = [
  { label: 'SAFE customer', phone: '+99999991000', hint: 'No swap' },
  { label: 'SAFE (alt)', phone: '+99999991001', hint: 'Clean' },
  { label: 'STOP — SIM swap', phone: '+99999990400', hint: 'Do not pay' },
  { label: 'STOP — SIM swap (alt)', phone: '+99999990404', hint: 'Do not pay' },
  { label: 'CAUTION — device', phone: '+99999990422', hint: 'Ask a question' },
] as const

export function apiBase(): string {
  const url = process.env.NEXT_PUBLIC_MOMO_SENTRY_API
  if (!url) {
    throw new Error('NEXT_PUBLIC_MOMO_SENTRY_API is not set')
  }
  return url.replace(/\/$/, '')
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = apiBase()
  try {
    return await fetch(`${base}${path}`, init)
  } catch {
    throw new Error(`Can't reach the API at ${base}. Start the backend (uvicorn on port 8000) and try again.`)
  }
}

export async function postCheck(args: {
  token: string
  phone_number: string
  agent_location: string
}): Promise<{
  check_id: string
  phone_number: string
  verdict: string
  narration: string
  signals: string[]
  checked_at: string
  agent_id?: string
  agent_name?: string
}> {
  const res = await apiFetch('/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      phone_number: args.phone_number,
      agent_location: args.agent_location,
      location: args.agent_location,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'Check failed'
    throw new Error(detail)
  }
  return body
}

export async function fetchOwnerNeeded(): Promise<boolean> {
  const res = await apiFetch('/setup/owner-needed')
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'Could not check owner setup'
    throw new Error(detail)
  }
  return Boolean(body.owner_needed)
}

export async function claimFirstOwner(token: string): Promise<void> {
  const res = await apiFetch('/setup/claim-owner', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'Could not create owner'
    throw new Error(detail)
  }
}
