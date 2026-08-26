import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { IconArrow, IconLoader, IconLogOut } from '../components/icons'
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
          <IconLoader size={20} />
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
            <input
              className="auth-input"
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </AuthField>
          <AuthField label="Password">
            <PasswordField
              value={loginPassword}
              onChange={setLoginPassword}
              show={showPwd}
              onToggle={() => setShowPwd(v => !v)}
              autoComplete="current-password"
            />
          </AuthField>
          <p className="auth-forgot">
            <Link href="/reset?next=/agent">Forgot password?</Link>
          </p>
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
      <div className="till-stage">
        <div className="till-device">
          <div className="till-app">
            <header className="till-nav">
              <div>
                <div className="till-screen-kicker">MoMo Sentry</div>
                <h1 className="till-screen-title">Number check</h1>
              </div>
              <div className="till-tools">
                <ThemeToggle />
              </div>
            </header>

            <form className="till-form" onSubmit={handleCheck}>
              <div className="till-body">
                <p className="till-hello">{agent.name}</p>
                <p className="till-place">{agent.primary_location}</p>

                <section className="till-card">
                  <label className="till-phone-label" htmlFor="customer-number">Customer number</label>
                  <input
                    id="customer-number"
                    className="till-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
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
                </section>

                <section className="till-card till-card-row">
                  <div>
                    <label className="field-label">Booth</label>
                    <Select
                      aria-label="Booth"
                      value={checkLocation}
                      onChange={setCheckLocation}
                      options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
                      placeholder="Select booth"
                    />
                  </div>
                </section>

                {checkError && <div className="till-alert"><AuthError>{checkError}</AuthError></div>}

                {result && (
                  <div className={`result is-${result.verdict}`}>
                    <div className="result-head">
                      <span className="metric-label">Last check</span>
                      <VerdictPill verdict={result.verdict as Verdict} />
                    </div>
                    <p className="result-body">{result.narration}</p>
                    <p className="mono hint" style={{ marginTop: 12 }}>{result.phone_number} · {verdictLabel(result.verdict)}</p>
                  </div>
                )}
              </div>

              <div className="till-dock">
                <button className="btn till-go" type="submit" disabled={checking}>
                  {checking
                    ? <><IconLoader /> Asking the network…</>
                    : <>Check number <IconArrow /></>}
                </button>
                <button
                  className="till-signout"
                  type="button"
                  onClick={() => { supabase.auth.signOut(); setAgent(null); setResult(null) }}
                >
                  <IconLogOut /> Sign out
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
