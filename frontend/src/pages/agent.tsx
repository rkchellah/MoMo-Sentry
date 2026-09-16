import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { IconArrow, IconLoader, IconLogOut, BrandLockup } from '../components/icons'
import { Select } from '../components/Select'
import { getBoothLocations } from '../lib/fraudService'
import { BoothLocation, Verdict } from '../types/sentry'
import { ThemeToggle } from '../components/ThemeToggle'
import { AuthShell, AuthError, AuthInput, PasswordField, AuthField, AuthActions, AuthForm } from '../components/AuthShell'
import { SANDBOX_CUSTOMERS, postCheck } from '../lib/sentryApi'
import { VerdictPill, verdictLabel } from '../components/VerdictPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

interface BoothAgent {
  id: string
  name: string
  phone: string
  primary_location: string
}

function chipShort(label: string): string {
  if (label.startsWith('SAFE (alt)')) return 'Safe 2'
  if (label.startsWith('SAFE')) return 'Safe'
  if (label.includes('(alt)')) return 'Stop 2'
  if (label.startsWith('STOP')) return 'Stop'
  if (label.startsWith('CAUTION')) return 'Caution'
  return label
}

function chipVariant(label: string): 'destructive' | 'outline' | 'secondary' {
  if (label.startsWith('STOP')) return 'destructive'
  if (label.startsWith('CAUTION')) return 'secondary'
  return 'outline'
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
      <div className="flex min-h-dvh items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <IconLoader size={20} />
          <p className="text-sm">Opening the till…</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <AuthShell
        title="Log in - MoMo Sentry"
        heading="Log in to the till."
        lede="Check a customer number before you pay out."
      >
        {loginError && <AuthError>{loginError}</AuthError>}
        <form onSubmit={handleLogin}>
          <AuthForm>
            <AuthField label="Email" htmlFor="agent-email">
              <AuthInput
                id="agent-email"
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Your email"
                autoComplete="email"
                required
                autoFocus
              />
            </AuthField>
            <AuthField label="Password" htmlFor="agent-password">
              <PasswordField
                id="agent-password"
                value={loginPassword}
                onChange={setLoginPassword}
                show={showPwd}
                onToggle={() => setShowPwd(v => !v)}
                autoComplete="current-password"
              />
            </AuthField>
          </AuthForm>
          <Button asChild variant="link" className="h-auto self-start px-0">
            <Link href="/reset?next=/agent">Forgot password?</Link>
          </Button>
          <AuthActions
            busy={loginLoading}
            label="Log in"
            aside={(
              <Button asChild variant="link">
                <Link href="/agent-register">Don&rsquo;t have an account?</Link>
              </Button>
            )}
          />
        </form>
      </AuthShell>
    )
  }

  return (
    <>
      <Head><title>Booth check - MoMo Sentry</title></Head>
      <div className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6">
        <Card className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col overflow-hidden">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <BrandLockup />
              <h1 className="mt-2 text-lg font-normal tracking-tight">Number check</h1>
            </div>
            <ThemeToggle />
          </header>

          <form className="flex flex-1 flex-col" onSubmit={handleCheck}>
            <CardContent className="flex flex-1 flex-col gap-4 py-5">
              <div>
                <p className="text-sm font-normal">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.primary_location}</p>
              </div>

              <section className="rounded-xl border border-border bg-muted/40 p-4">
                <Label htmlFor="customer-number" className="mb-1.5">Customer number</Label>
                <Input
                  id="customer-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={checkPhone}
                  onChange={e => setCheckPhone(e.target.value)}
                  placeholder="+99999991000"
                  required
                  className="font-mono"
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SANDBOX_CUSTOMERS.map(c => (
                    <Button
                      key={c.phone}
                      type="button"
                      size="xs"
                      variant={checkPhone === c.phone ? 'default' : chipVariant(c.label)}
                      onClick={() => setCheckPhone(c.phone)}
                      title={c.label}
                    >
                      {chipShort(c.label)}
                    </Button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Simulator only. SAFE is no swap in 72 hours - not that the person is legitimate.
                </p>
              </section>

              <section>
                <Label className="mb-1.5">Booth</Label>
                <Select
                  aria-label="Booth"
                  value={checkLocation}
                  onChange={setCheckLocation}
                  options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
                  placeholder="Select booth"
                />
              </section>

              {checkError && <AuthError>{checkError}</AuthError>}

              {result && (
                <Card size="sm">
                  <CardContent className="flex flex-col gap-3 pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-normal uppercase text-muted-foreground">Last check</span>
                      <VerdictPill verdict={result.verdict as Verdict} />
                    </div>
                    <p className="text-sm">{result.narration}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {result.phone_number} · {verdictLabel(result.verdict)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </CardContent>

            <div className="mt-auto space-y-2 border-t border-border px-5 py-4">
              <Button className="w-full" type="submit" disabled={checking}>
                {checking
                  ? <><IconLoader /> Asking the network…</>
                  : <>Check number <IconArrow /></>}
              </Button>
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={() => { supabase.auth.signOut(); setAgent(null); setResult(null) }}
              >
                <IconLogOut /> Sign out
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
