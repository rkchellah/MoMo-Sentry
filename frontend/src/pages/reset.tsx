import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { AuthShell, AuthError, AuthNotice, AuthField, AuthActions, PasswordField } from '../components/AuthShell'

function nextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === '/agent' || value === '/sentry') return value
  return '/sentry'
}

export default function ResetPage() {
  const router = useRouter()
  const next = nextPath(router.query.next)
  const [mode, setMode] = useState<'request' | 'set'>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setMode('set')
    })
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setMode('set')
    }
    return () => subscription.unsubscribe()
  }, [])

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const redirectTo = `${window.location.origin}/reset?next=${encodeURIComponent(next)}`
    const { error: sendErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (sendErr) setError(sendErr.message)
    else setSent(true)
    setBusy(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    setBusy(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(updateErr.message)
      setBusy(false)
      return
    }
    router.push(next)
  }

  if (mode === 'set') {
    return (
      <AuthShell title="New password — MoMo Sentry" heading="Choose a new password">
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={savePassword}>
          <AuthField label="Password">
            <PasswordField
              value={password}
              onChange={setPassword}
              show={showPwd}
              onToggle={() => setShowPwd(v => !v)}
              autoComplete="new-password"
            />
          </AuthField>
          <AuthActions
            busy={busy}
            label="Save password"
            aside={<Link href={next}>Back to log in</Link>}
          />
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset password — MoMo Sentry" heading="Reset your password">
      {error && <AuthError>{error}</AuthError>}
      {sent && (
        <AuthNotice>
          If that email has an account, a reset link is on its way. Open it on this same device.
        </AuthNotice>
      )}
      <form onSubmit={sendLink}>
        <AuthField label="Email">
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </AuthField>
        <AuthActions
          busy={busy}
          label="Send link"
          aside={<Link href={next}>Back to log in</Link>}
        />
      </form>
    </AuthShell>
  )
}
