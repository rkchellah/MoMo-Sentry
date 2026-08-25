import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { BrandLockup, IconArrow } from '../components/icons'
import { Select } from '../components/Select'
import { getBoothLocations } from '../lib/fraudService'
import { BoothLocation, Verdict } from '../types/sentry'
import { ThemeToggle } from '../components/ThemeToggle'
import { AuthShell, AuthError, PasswordField, AuthField, AuthActions } from '../components/AuthShell'
import { SANDBOX_CUSTOMERS, postCheck } from '../lib/sentryApi'
import { VerdictPill, verdictLabel } from '../components/VerdictPill'

interface BoothAgent {
  id: string
  name: string
  phone: string
  primary_location: string
}

/** Short chip labels so the till reads as a control, not a form. */
function chipShort(label: string): string {
  if (label.startsWith('SAFE (alt)')) return 'Safe 2'
  if (label.startsWith('SAFE')) return 'Safe'
  if (label.includes('(alt)')) return 'Stop 2'
  if (label.startsWith('STOP')) return 'Stop'
  if (label.startsWith('CAUTION')) return 'Caution'
  return label
}

function chipTone(label: string): string {
  if (label.startsWith('STOP')) return ' chip-stop'
  if (label.startsWith('CAUTION')) return ' chip-caution'
  if (label.startsWith('SAFE')) return ' chip-safe'
  return ''
}

export default function AgentPage() {
  const [authLoading, setAuthLoading] = useState(true)
  const [agent, setAgent] = useState<BoothAgent | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [checkPhone, setCheckPhone] = useState('')
  const [checkLocation, setCheckLocation] = useState('')
  const [boothLocations, setBoothLocations] = useState<BoothLocation[]>([])
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ verdict: string; narration: string; phone_number: string } | null>(null)
  const [checkError, setCheckError] = useState('')

  useEffect(() => {
    getBoothLocations().then(locs => {
      setBoothLocations(locs)
      if (locs[0]) setCheckLocation(locs[0].name)
    }).catch(console.error)

    const timeout = setTimeout(() => setAuthLoading(false), 3000)
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(timeout)
        if (session) await loadAgent(session.user.id)
        setAuthLoading(false)
      })
      .catch(() => { clearTimeout(timeout); setAuthLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { setAgent(null); return }
      await loadAgent(session.user.id)
    })
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  async function loadAgent(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('booth_agents')
      .select('id, name, phone, primary_location')
      .eq('user_id', userId)
      .single()
    if (data) {
      setAgent(data)
      setCheckLocation(data.primary_location)
      return true
    }
    return false
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) {
      setLoginError(error.message)
      setLoginLoading(false)
      return
    }
    if (data.session) {
      const ok = await loadAgent(data.session.user.id)
      if (!ok) {
        await supabase.auth.signOut()
        setLoginError('This account has no booth till. Register, or open operations.')
      }
    }
    setLoginLoading(false)
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!checkPhone || checking || !agent) return
    setChecking(true)
    setResult(null)
    setCheckError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')
      setResult(await postCheck({ token, phone_number: checkPhone, agent_location: checkLocation }))
      setCheckPhone('')
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Failed to perform fraud check.')
    } finally {
      setChecking(false)
    }
  }

  if (authLoading) {
    return (
      <div className="page-loader">
        <div>
          <div className="spinner" />
          <p className="hint" style={{ textAlign: 'center' }}>Opening the till…</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <AuthShell title="Log in — MoMo Sentry" heading="Log in to MoMo Sentry">
        {loginError && <AuthError>{loginError}</AuthError>}
        <form onSubmit={handleLogin}>
          <AuthField label="Email">
            <input className="auth-input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" required autoFocus />
          </AuthField>
          <AuthField label="Password">
            <PasswordField value={loginPassword} onChange={setLoginPassword} show={showPwd} onToggle={() => setShowPwd(v => !v)} autoComplete="current-password" />
          </AuthField>
          <AuthActions
            busy={loginLoading}
            label="Log in"
            aside={<Link href="/agent-register">Don&rsquo;t have an account?</Link>}
          />
        </form>
      </AuthShell>
    )
  }

  return (
    <>
      <Head><title>Booth check — MoMo Sentry</title></Head>
      <div className="app-shell">
        <div className="page" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="till">
            <div className="till-top">
              <BrandLockup />
              <div className="till-tools">
                <span className="till-badge"><span className="dot-live" /> Sandbox</span>
                <ThemeToggle />
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => { supabase.auth.signOut(); setAgent(null); setResult(null) }}
                >
                  Sign out
                </button>
              </div>
            </div>
            <h1 className="till-name">{agent.name}</h1>
            <p className="till-place">{agent.primary_location}</p>

            <div className="till-card">
              <form onSubmit={handleCheck}>
                <label className="till-phone-label" htmlFor="customer-number">Number</label>
                <input
                  id="customer-number"
                  className="till-phone"
                  type="tel"
                  value={checkPhone}
                  onChange={e => setCheckPhone(e.target.value)}
                  placeholder="+99999991000"
                  required
                />
                <div className="till-seg">
                  {SANDBOX_CUSTOMERS.map(c => (
                    <button
                      key={c.phone}
                      type="button"
                      className={`chip${chipTone(c.label)}${checkPhone === c.phone ? ' is-on' : ''}`}
                      onClick={() => setCheckPhone(c.phone)}
                      title={c.label}
                    >
                      {chipShort(c.label)}
                    </button>
                  ))}
                </div>
                <p className="hint till-hint">Simulator only. SAFE is no swap in 72 hours — not that the person is legitimate.</p>
                <div className="till-booth">
                  <label className="field-label">Booth</label>
                  <Select
                    aria-label="Booth"
                    value={checkLocation}
                    onChange={setCheckLocation}
                    options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
                    placeholder="Select booth"
                  />
                </div>
                <button className="btn till-go" type="submit" disabled={checking}>
                  {checking
                    ? <><span className="spinner spinner-inline" /> Asking the network…</>
                    : <>Check number <IconArrow /></>}
                </button>
              </form>
            </div>

            {checkError && <div style={{ marginTop: 14 }}><AuthError>{checkError}</AuthError></div>}

            {result && (
              <div className={`result is-${result.verdict}`}>
                <div className="result-head">
                  <span className="metric-label">Verdict</span>
                  <VerdictPill verdict={result.verdict as Verdict} />
                </div>
                <p className="result-body">{result.narration}</p>
                <p className="mono hint" style={{ marginTop: 12 }}>{result.phone_number} · {verdictLabel(result.verdict)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
