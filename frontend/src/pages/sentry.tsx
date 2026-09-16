import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

import {
  FraudCheck, FraudStats, computeFraudStats, BoothLocation,
  MapPoint, jitterFor, displayAgentName, formatCheckTime, BaseMap,
} from '../types/sentry'
import { getFraudChecks, getBoothLocations } from '../lib/fraudService'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'
import { AuthShell, AuthError, AuthInput, PasswordField, AuthField, AuthActions, AuthForm } from '../components/AuthShell'
import { VerdictPill } from '../components/VerdictPill'
import { Select } from '../components/Select'
import { WhereView } from '../components/WhereView'
import { claimFirstOwner, fetchOwnerNeeded, postCheck, SANDBOX_CUSTOMERS } from '../lib/sentryApi'
import {
  BrandLockup, IconArrow, IconInbox, IconPin, IconSearch, IconRefresh,
  IconList, IconMap, IconLoader, IconBan, IconCaution, IconFailed, IconShield, IconLogOut, IconUsers,
} from '../components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const LUSAKA_FALLBACK = { lat: -15.4166, lng: 28.2833 }

function checkGroupKey(check: FraudCheck) {
  return `${check.agent_id || 'none'}::${check.agent_location || 'Unknown'}`
}

export default function SentryPage() {
  const [authLoading, setAuthLoading] = useState(true)
  const [ownerOk, setOwnerOk] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [ownerNeeded, setOwnerNeeded] = useState<boolean | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'create'>('signin')

  const [tab, setTab] = useState<'queue' | 'where'>('queue')
  const [checks, setChecks] = useState<FraudCheck[]>([])
  const [checksLoading, setChecksLoading] = useState(true)
  const [agents, setAgents] = useState<{
    id: string; name: string; primary_location: string; latitude?: number; longitude?: number
  }[]>([])
  const [boothLocations, setBoothLocations] = useState<BoothLocation[]>([])
  const [verdictFilter, setVerdictFilter] = useState('')
  const [basemap, setBasemap] = useState<BaseMap>('auto')
  const [checkPhone, setCheckPhone] = useState('')
  const [checkLocation, setCheckLocation] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  async function confirmOwner() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setOwnerOk(false); return }
    const { data } = await supabase
      .from('momo_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setOwnerOk(data?.role === 'owner')
    if (data && data.role !== 'owner') {
      setLoginError('This account is not an owner. Use the agent screen.')
      await supabase.auth.signOut()
    }
  }

  useEffect(() => {
    fetchOwnerNeeded()
      .then(needed => setOwnerNeeded(needed))
      .catch(() => setOwnerNeeded(null))
    confirmOwner().finally(() => setAuthLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        setOwnerOk(false)
        return
      }
      void confirmOwner()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ownerOk) return
    getBoothLocations().then(locs => {
      setBoothLocations(locs)
      if (locs[0]) setCheckLocation(locs[0].name)
    }).catch(console.error)
    supabase.from('booth_agents').select('id, name, primary_location, latitude, longitude').order('name')
      .then(({ data }) => setAgents(data ?? []))
    loadChecks().finally(() => setChecksLoading(false))
    const t = setInterval(loadChecks, 30_000)
    return () => clearInterval(t)
  }, [ownerOk])

  async function loadChecks() {
    try {
      setChecks(await getFraudChecks())
      setFetchedAt(new Date().toISOString())
    } catch (err) {
      console.error(err)
    }
  }

  async function finishOwnerSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    // Returning owners only need Supabase. Don't block login on a down local API.
    const { data: profile } = await supabase
      .from('momo_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (profile?.role === 'owner') {
      setOwnerOk(true)
      setOwnerNeeded(false)
      return
    }

    if (profile && profile.role !== 'owner') {
      throw new Error('This account is not an owner. Use the agent screen.')
    }

    // First-owner claim needs the FastAPI setup route.
    if (ownerNeeded !== false) {
      await claimFirstOwner(session.access_token)
      setOwnerNeeded(false)
    }
    await confirmOwner()
  }

  async function enterOperations() {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail, password: loginPassword,
    })
    if (error) throw error
    await finishOwnerSession()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await enterOperations()
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not sign in')
    }
    setLoginLoading(false)
  }

  async function handleCreateOwner(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: loginEmail, password: loginPassword,
    })
    if (error) {
      if (/already registered/i.test(error.message)) {
        try {
          await enterOperations()
        } catch {
          setLoginError('This email is already registered. Sign in instead.')
        }
        setAuthMode('signin')
        setLoginLoading(false)
        return
      }
      setLoginError(error.message)
      setLoginLoading(false)
      return
    }
    if (!data.session) {
      setLoginError('Account created. Confirm the email if asked, then sign in to claim owner.')
      setAuthMode('signin')
      setLoginLoading(false)
      return
    }
    try {
      await finishOwnerSession()
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not create owner')
    }
    setLoginLoading(false)
  }

  function coordsFor(locationName: string) {
    const booth = boothLocations.find(l => l.name === locationName) || boothLocations[0]
    return booth ? { lat: booth.latitude, lng: booth.longitude } : LUSAKA_FALLBACK
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!checkPhone || checking) return
    setChecking(true)
    setCheckError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')
      await postCheck({ token, phone_number: checkPhone, agent_location: checkLocation })
      setCheckPhone('')
      await loadChecks()
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return checks.filter(c => {
      if (verdictFilter && c.verdict !== verdictFilter) return false
      if (!q) return true
      return [c.phone_number, c.agent_location, c.narration, displayAgentName(c.agent_name)]
        .some(field => field?.toLowerCase().includes(q))
    })
  }, [checks, verdictFilter, query])

  const stats: FraudStats = useMemo(() => computeFraudStats(checks), [checks])

  const repeats = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of checks) map.set(c.phone_number, (map.get(c.phone_number) ?? 0) + 1)
    return [...map.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
  }, [checks])

  const neverChecked = useMemo(() => {
    const seen = new Set(checks.map(c => c.agent_id).filter(Boolean))
    return agents.filter(a => !seen.has(a.id))
  }, [agents, checks])

  const points: MapPoint[] = useMemo(() => {
    const visible = verdictFilter ? checks.filter(c => c.verdict === verdictFilter) : checks
    const groups = new Map<string, FraudCheck[]>()
    for (const check of visible) {
      const key = checkGroupKey(check)
      const list = groups.get(key) ?? []
      list.push(check)
      groups.set(key, list)
    }
    return [...groups.entries()].map(([key, list]) => {
      const latest = list[0]
      const agent = agents.find(a => a.id === latest.agent_id)
      const coords = agent?.latitude != null && agent.longitude != null
        ? { lat: agent.latitude, lng: agent.longitude }
        : coordsFor(latest.agent_location)
      const [dLat, dLng] = jitterFor(key, 0.006)
      return {
        id: key,
        label: displayAgentName(latest.agent_name || agent?.name),
        sublabel: `${latest.agent_location} · ${list.length} ${list.length === 1 ? 'check' : 'checks'}`,
        verdict: latest.verdict,
        latitude: coords.lat + dLat,
        longitude: coords.lng + dLng,
        checkCount: list.length,
      }
    })
  }, [agents, checks, verdictFilter, boothLocations])

  const selectedCheck = checks.find(c => c.id === selectedCheckId) ?? null
  const focusPointId = selectedCheck ? checkGroupKey(selectedCheck) : null

  function openCheckOnMap(check: FraudCheck) {
    setSelectedCheckId(check.id)
    setTab('where')
  }

  // Rows and pins address the same group; focus its newest check so the popup
  // and the Queue selection agree.
  function focusPoint(pointId: string) {
    const group = checks.filter(c => checkGroupKey(c) === pointId)
    if (group[0]) setSelectedCheckId(group[0].id)
  }

  if (authLoading) {
    return (
      <div className="page-loader">
        <div>
          <IconLoader size={20} />
          <p className="hint" style={{ textAlign: 'center' }}>Checking your session…</p>
        </div>
      </div>
    )
  }

  if (!ownerOk) {
    const creating = authMode === 'create'
    return (
      <AuthShell
        title={creating ? 'Create account - MoMo Sentry' : 'Log in - MoMo Sentry'}
        heading={creating ? 'Create an operations account.' : 'Log in to operations.'}
        lede={creating
          ? 'First owner on this project claims the queue. Agents use the booth till.'
          : 'Queue of every booth check, plus the Lusaka map.'}
      >
        {loginError && <AuthError>{loginError}</AuthError>}
        <form onSubmit={creating ? handleCreateOwner : handleLogin}>
          <AuthForm>
            <AuthField label="Email" htmlFor="ops-email">
              <AuthInput
                id="ops-email"
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="Your email"
              />
            </AuthField>
            <AuthField label="Password" htmlFor="ops-password">
              <PasswordField
                id="ops-password"
                value={loginPassword}
                onChange={setLoginPassword}
                show={showPwd}
                onToggle={() => setShowPwd(v => !v)}
                autoComplete={creating ? 'new-password' : 'current-password'}
              />
            </AuthField>
          </AuthForm>
          {!creating && (
            <Button asChild variant="link" className="h-auto self-start px-0">
              <Link href="/reset?next=/sentry">Forgot password?</Link>
            </Button>
          )}
          <AuthActions
            busy={loginLoading}
            label={creating ? 'Continue' : 'Log in'}
            aside={
              creating
                ? (
                  <Button type="button" variant="link" onClick={() => setAuthMode('signin')}>
                    Already have an account?
                  </Button>
                )
                : (
                  <>
                    {ownerNeeded !== false && (
                      <Button type="button" variant="link" onClick={() => setAuthMode('create')}>
                        Don&rsquo;t have an account?
                      </Button>
                    )}
                    {ownerNeeded === false && (
                      <Button asChild variant="link">
                        <Link href="/agent">Booth till login</Link>
                      </Button>
                    )}
                  </>
                )
            }
          />
        </form>
      </AuthShell>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Head><title>Operations - MoMo Sentry</title></Head>
      <Tabs value={tab} onValueChange={v => setTab(v as 'queue' | 'where')} className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2.5">
            <Link href="/" className="mr-1 shrink-0">
              <BrandLockup />
            </Link>

            <TabsList className="h-9">
              <TabsTrigger value="queue" className="gap-1.5 px-3">
                <IconList data-icon="inline-start" />
                Queue
              </TabsTrigger>
              <TabsTrigger value="where" className="gap-1.5 px-3">
                <IconMap data-icon="inline-start" />
                Where
              </TabsTrigger>
            </TabsList>

            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

            <form onSubmit={handleCheck} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    Samples
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Simulator numbers</DropdownMenuLabel>
                    {SANDBOX_CUSTOMERS.map(c => (
                      <DropdownMenuItem
                        key={c.phone}
                        onSelect={() => setCheckPhone(c.phone)}
                      >
                        <span className="flex flex-col gap-0.5">
                          <span>{c.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">{c.phone}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Input
                className="w-[10.5rem] font-mono"
                value={checkPhone}
                onChange={e => setCheckPhone(e.target.value)}
                placeholder="+999…"
                required
                aria-label="Customer number"
              />
              <Select
                aria-label="Booth"
                value={checkLocation}
                onChange={setCheckLocation}
                options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
                placeholder="Booth"
                className="w-[10.5rem]"
              />
              <Button type="submit" size="sm" disabled={checking}>
                {checking ? <Spinner data-icon="inline-start" /> : null}
                {checking ? 'Checking…' : 'Check'}
                {!checking ? <IconArrow data-icon="inline-end" /> : null}
              </Button>
            </form>

            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/agent">Agent</Link>
              </Button>
              <ThemeToggle />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { supabase.auth.signOut(); setOwnerOk(false) }}
              >
                <IconLogOut data-icon="inline-start" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {checkError && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-3">
            <AuthError>{checkError}</AuthError>
          </div>
        )}

        <TabsContent value="queue" className="mt-0 flex-1">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-normal tracking-tight">Operations queue</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every booth check, newest first · refreshes every 30s
                </p>
              </div>
              <div className="flex items-center gap-2">
                {fetchedAt && (
                  <span className="text-xs text-muted-foreground">Updated {formatCheckTime(fetchedAt)}</span>
                )}
                <Button type="button" variant="outline" size="icon-sm" title="Refresh now" onClick={loadChecks}>
                  <IconRefresh />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {METRIC_CARDS.map(m => {
                const active = Boolean(m.filter && verdictFilter === m.filter)
                return (
                  <Card
                    key={m.label}
                    size="sm"
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'cursor-pointer transition hover:bg-muted/40',
                      active && 'ring-2 ring-ring',
                      m.tone === 'is-stop' && 'border-destructive/30',
                      m.tone === 'is-caution' && 'border-warning/40',
                    )}
                    onClick={() => setVerdictFilter(verdictFilter === m.filter ? '' : m.filter)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setVerdictFilter(verdictFilter === m.filter ? '' : m.filter)
                      }
                    }}
                    title={m.filter ? `Filter to ${m.label.toLowerCase()}` : 'Clear the filter'}
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <CardDescription>{m.label}</CardDescription>
                      <m.icon className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-normal tracking-tight">
                        {checksLoading ? '-' : m.value(stats, neverChecked.length)}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{m.foot}</span>
                        {active && <Badge variant="secondary">on</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Flags</CardTitle>
                  <Badge variant="secondary">{filtered.length}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictFilters value={verdictFilter} onChange={setVerdictFilter} />
                  <div className="relative min-w-[220px] flex-1">
                    <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search number, agent, booth…"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <ScrollArea className="h-[min(420px,50vh)] w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-normal">Time</th>
                        <th className="px-4 py-2 font-normal">Number</th>
                        <th className="px-4 py-2 font-normal">Verdict</th>
                        <th className="px-4 py-2 font-normal">Agent</th>
                        <th className="px-4 py-2 font-normal">Booth</th>
                        <th className="px-4 py-2 font-normal">Narration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checksLoading && [0, 1, 2, 3].map(i => (
                        <tr key={`skel-${i}`} className="border-b border-border">
                          {[92, 118, 64, 96, 104, 220].map((w, j) => (
                            <td key={j} className="px-4 py-3">
                              <span className="block h-4 animate-pulse rounded bg-muted" style={{ width: w }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!checksLoading && filtered.map(row => (
                        <tr
                          key={row.id}
                          className={cn(
                            'cursor-pointer border-b border-border hover:bg-muted/40',
                            selectedCheckId === row.id && 'bg-muted',
                          )}
                          onClick={() => openCheckOnMap(row)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatCheckTime(row.checked_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.phone_number}</td>
                          <td className="px-4 py-3"><VerdictPill verdict={row.verdict} /></td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-normal">
                                {initialsOf(displayAgentName(row.agent_name))}
                              </span>
                              <span>{displayAgentName(row.agent_name)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.agent_location}</td>
                          <td className="max-w-sm truncate px-4 py-3 text-muted-foreground">{row.narration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {!checksLoading && filtered.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                    <IconInbox className="size-5" />
                    {query || verdictFilter
                      ? 'No check matches this filter.'
                      : 'No checks yet. Run a simulator number from the bar.'}
                  </div>
                )}
              </CardContent>
              {!checksLoading && filtered.length > 0 && (
                <CardFooter className="text-xs text-muted-foreground">
                  {filtered.length === checks.length
                    ? `All ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} shown.`
                    : `${filtered.length} of ${checks.length} checks shown.`}
                </CardFooter>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <CardTitle>Repeat numbers</CardTitle>
                  <Badge variant="secondary">{repeats.length}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {repeats.length === 0 && (
                    <p className="text-sm text-muted-foreground">No number has been checked twice.</p>
                  )}
                  {repeats.map(([phone, n]) => (
                    <div key={phone} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                      <span className="font-mono text-xs">{phone}</span>
                      <span className="text-xs text-muted-foreground">{n} checks</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <CardTitle>Agents with zero checks</CardTitle>
                  <Badge variant="secondary">{neverChecked.length}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {neverChecked.length === 0 && (
                    <p className="text-sm text-muted-foreground">Every registered agent has checked.</p>
                  )}
                  {neverChecked.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-normal">
                          {initialsOf(a.name)}
                        </span>
                        <span className="text-sm">{a.name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <IconPin className="size-3.5" /> {a.primary_location}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="where" className="mt-0 flex-1">
          <WhereView
            points={points}
            checks={checks}
            basemap={basemap}
            onBasemap={setBasemap}
            verdictFilter={verdictFilter}
            onVerdictFilter={setVerdictFilter}
            focusPointId={focusPointId}
            onFocusPoint={focusPoint}
            selectedCheckId={selectedCheckId}
            queueRows={filtered.length}
            onOpenQueue={() => setTab('queue')}
            filters={<VerdictFilters value={verdictFilter} onChange={setVerdictFilter} />}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const METRIC_CARDS: {
  label: string
  foot: string
  tone: string
  filter: string
  icon: typeof IconShield
  value: (stats: FraudStats, neverChecked: number) => number
}[] = [
  { label: 'Checks', foot: 'all time', tone: 'is-quiet', filter: '', icon: IconShield, value: s => s.total },
  { label: 'Stop', foot: 'do not pay', tone: 'is-stop', filter: 'STOP', icon: IconBan, value: s => s.stop },
  { label: 'Caution', foot: 'ask a question', tone: 'is-caution', filter: 'CAUTION', icon: IconCaution, value: s => s.caution },
  { label: 'Failed', foot: 'network error', tone: '', filter: 'CHECK_FAILED', icon: IconFailed, value: s => s.failed },
  { label: 'Never checked', foot: 'registered agents', tone: 'is-quiet', filter: '', icon: IconUsers, value: (_s, n) => n },
]

function VerdictFilters({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'STOP', label: 'Stop' },
    { value: 'CAUTION', label: 'Caution' },
    { value: 'CHECK_FAILED', label: 'Failed' },
    { value: 'SAFE', label: 'Safe' },
  ] as const

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={1}
      value={value || 'all'}
      onValueChange={next => {
        if (!next) return
        onChange(next === 'all' ? '' : next)
      }}
      className="flex w-max flex-nowrap items-center gap-1"
    >
      {options.map(opt => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className="h-8 shrink-0 rounded-full px-2.5 text-xs font-normal capitalize"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
