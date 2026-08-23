import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { BrandLockup, IconArrow } from '../components/icons'
import { Select } from '../components/Select'
import { getBoothLocations } from '../lib/fraudService'
import { BoothLocation, Verdict } from '../types/sentry'
import { SandboxBanner } from '../components/SandboxBanner'
import { ThemeToggle } from '../components/ThemeToggle'
import { AuthShell, AuthError, PasswordField } from '../components/AuthShell'
import { SANDBOX_CUSTOMERS, postCheck } from '../lib/sentryApi'
import { VerdictPill, verdictLabel } from '../components/VerdictPill'

interface BoothAgent {
  id: string
  name: string
  phone: string
  primary_location: string
}

/** Chip tone follows the verdict the sandbox number is meant to produce. */
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

  async function loadAgent(userId: string) {
    const { data } = await supabase
      .from('booth_agents')
      .select('id, name, phone, primary_location')
      .eq('user_id', userId)
      .single()
    if (data) {
      setAgent(data)
      setCheckLocation(data.primary_location)
    }
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
    if (data.session) await loadAgent(data.session.user.id)
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
      <AuthShell
        title="Agent sign in — Lintel Zambia"
        asideTitle="Check a number before you pay out."
      >
        <BrandLockup />
        <h1>Agent sign in</h1>
        <p className="lede">Booth till for Lintel Zambia. Use a simulator number, or type +999…</p>
        {loginError && <AuthError>{loginError}</AuthError>}
        <form onSubmit={handleLogin}>
          <label className="field-label">Email</label>
          <input className="field-input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" placeholder="you@lintel.zm" required />
          <label className="field-label" style={{ marginTop: 14 }}>Password</label>
          <PasswordField value={loginPassword} onChange={setLoginPassword} show={showPwd} onToggle={() => setShowPwd(v => !v)} autoComplete="current-password" />
          <button className="btn" type="submit" disabled={loginLoading} style={{ marginTop: 22, width: '100%' }}>
            {loginLoading ? <><span className="spinner spinner-inline" /> Signing in…</> : <>Sign in <IconArrow /></>}
          </button>
        </form>
        <p className="auth-foot">No account? <Link href="/agent-register">Register</Link> · <Link href="/sentry">Owner</Link></p>
      </AuthShell>
    )
  }

  return (
    <>
      <Head><title>Booth check — Lintel Zambia</title></Head>
      <div className="app-shell">
        <SandboxBanner />
        <div className="page" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="till">
            <div className="till-top">
              <div>
                <BrandLockup />
                <h1 style={{ fontSize: 21, fontWeight: 620, letterSpacing: '-0.03em', margin: '18px 0 4px' }}>{agent.name}</h1>
                <p className="hint" style={{ margin: 0 }}>{agent.primary_location}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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

            <div className="till-card">
              <div className="till-kicker">Number check</div>
              <form onSubmit={handleCheck}>
                <label className="field-label">Customer number</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {SANDBOX_CUSTOMERS.map(c => (
                    <button
                      key={c.phone}
                      type="button"
                      className={`chip${chipTone(c.label)}${checkPhone === c.phone ? ' is-on' : ''}`}
                      onClick={() => setCheckPhone(c.phone)}
                      title={c.hint}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input className="field-input mono" type="tel" value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="+99999991000" required />
                <p className="hint">SAFE means no swap in the last 72 hours on this simulator — not that the person is legitimate.</p>
                <label className="field-label" style={{ marginTop: 16 }}>Booth</label>
                <Select
                  aria-label="Booth"
                  value={checkLocation}
                  onChange={setCheckLocation}
                  options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
                  placeholder="Select booth"
                />
                <button className="btn" type="submit" disabled={checking} style={{ marginTop: 20, width: '100%', height: 46 }}>
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
