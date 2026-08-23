import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

import {
  FraudCheck, FraudStats, computeFraudStats, BoothLocation,
  MapPoint, jitterFor, displayAgentName, formatCheckTime, BaseMap,
} from '../types/sentry'
import { getFraudChecks, getBoothLocations } from '../lib/fraudService'
import { supabase } from '../lib/supabase'
import { SandboxBanner } from '../components/SandboxBanner'
import { ThemeToggle } from '../components/ThemeToggle'
import { AuthShell, AuthError, PasswordField } from '../components/AuthShell'
import { VerdictPill } from '../components/VerdictPill'
import { Select } from '../components/Select'
import { WhereView } from '../components/WhereView'
import { claimFirstOwner, fetchOwnerNeeded, postCheck, SANDBOX_CUSTOMERS } from '../lib/sentryApi'
import {
  BrandLockup, IconArrow, IconInbox, IconPin, IconSearch, IconRefresh,
} from '../components/icons'

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
  const [authMode, setAuthMode] = useState<'signin' | 'create'>('create')

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
      .then(needed => {
        setOwnerNeeded(needed)
        setAuthMode(needed ? 'create' : 'signin')
      })
      .catch(err => setLoginError(err instanceof Error ? err.message : 'Could not check owner setup'))
    confirmOwner().finally(() => setAuthLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setOwnerOk(false)
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
    if (ownerNeeded !== false) {
      await claimFirstOwner(session.access_token)
      setOwnerNeeded(false)
    }
    await confirmOwner()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail, password: loginPassword,
    })
    if (error) {
      setLoginError(error.message)
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

  async function handleCreateOwner(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: loginEmail, password: loginPassword,
    })
    if (error) {
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
          <div className="spinner" />
          <p className="hint" style={{ textAlign: 'center' }}>Checking your session…</p>
        </div>
      </div>
    )
  }

  if (!ownerOk) {
    const creating = authMode === 'create'
    return (
      <AuthShell
        title={creating ? 'Create owner — Lintel Zambia' : 'Owner sign in — Lintel Zambia'}
        asideTitle="Owner operations for Lintel Zambia."
        asideBody="Queue lists every check from every booth. Where puts the same rows on a map of Lusaka."
      >
        <BrandLockup />
        <h1>{creating ? 'Create the first owner' : 'Owner sign in'}</h1>
        <p className="lede">
          {creating
            ? 'No owner exists yet. This login becomes the operations account.'
            : 'Operations for Lintel Zambia booth checks.'}
        </p>
        {loginError && <AuthError>{loginError}</AuthError>}
        <form onSubmit={creating ? handleCreateOwner : handleLogin}>
          <label className="field-label">Email</label>
          <input className="field-input" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" placeholder="owner@lintel.zm" />
          <label className="field-label" style={{ marginTop: 14 }}>Password</label>
          <PasswordField
            value={loginPassword}
            onChange={setLoginPassword}
            show={showPwd}
            onToggle={() => setShowPwd(v => !v)}
            autoComplete={creating ? 'new-password' : 'current-password'}
          />
          <button className="btn" type="submit" disabled={loginLoading} style={{ marginTop: 22, width: '100%' }}>
            {loginLoading
              ? <><span className="spinner spinner-inline" /> {creating ? 'Creating…' : 'Signing in…'}</>
              : <>{creating ? 'Create owner' : 'Sign in'} <IconArrow /></>}
          </button>
        </form>
        {ownerNeeded !== false && (
          <p className="auth-foot">
            <button type="button" className="btn-link" onClick={() => setAuthMode(creating ? 'signin' : 'create')}>
              {creating ? 'Already have a login' : 'Create the first owner'}
            </button>
          </p>
        )}
        <p className="auth-foot">Booth agent? <Link href="/agent">Check screen</Link></p>
      </AuthShell>
    )
  }

  return (
    <div className="app-shell">
      <Head><title>Operations — Lintel Zambia</title></Head>
      <SandboxBanner />
      <header className="app-bar">
        <BrandLockup />
        <div className="tabs">
          <button type="button" className={`tab${tab === 'queue' ? ' is-on' : ''}`} onClick={() => setTab('queue')}>Queue</button>
          <button type="button" className={`tab${tab === 'where' ? ' is-on' : ''}`} onClick={() => setTab('where')}>Where</button>
        </div>
        <form onSubmit={handleCheck} className="bar-form">
          {SANDBOX_CUSTOMERS.slice(0, 3).map(c => (
            <button key={c.phone} type="button" className={`chip${checkPhone === c.phone ? ' is-on' : ''}`} onClick={() => setCheckPhone(c.phone)} title={c.hint}>{c.label}</button>
          ))}
          <input className="field-input mono" value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="+999…" required
            style={{ width: 150, height: 38 }} />
          <Select
            aria-label="Booth"
            value={checkLocation}
            onChange={setCheckLocation}
            options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
            placeholder="Booth"
            className="select-bar"
            style={{ width: 180 }}
          />
          <button type="submit" className="btn btn-sm" disabled={checking}>
            {checking
              ? <span className="spinner spinner-inline" />
              : 'Check'}
          </button>
          <Link href="/agent" className="btn-link">Agent</Link>
          <ThemeToggle />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { supabase.auth.signOut(); setOwnerOk(false) }}>Sign out</button>
        </form>
      </header>
      {checkError && (
        <div style={{ padding: '10px 20px 0', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <AuthError>{checkError}</AuthError>
        </div>
      )}

      {tab === 'queue' && (
        <div className="page">
          <div className="page-head">
            <div>
              <h1 className="page-title">Operations queue</h1>
              <p className="page-sub">Every booth check, newest first · refreshes every 30s</p>
            </div>
            <div className="toolbar">
              {fetchedAt && (
                <span className="hint" style={{ margin: 0 }}>Updated {formatCheckTime(fetchedAt)}</span>
              )}
              <button type="button" className="icon-btn" title="Refresh now" onClick={loadChecks}>
                <IconRefresh />
              </button>
            </div>
          </div>

          <div className="metrics">
            {METRIC_CARDS.map((m, i) => (
              <button
                key={m.label}
                type="button"
                className={`metric${m.tone}${m.filter && verdictFilter === m.filter ? ' is-on' : ''}`}
                style={{ animationDelay: `${i * 40}ms`, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setVerdictFilter(verdictFilter === m.filter ? '' : m.filter)}
                title={m.filter ? `Filter to ${m.label.toLowerCase()}` : 'Clear the filter'}
              >
                <span className="metric-top">
                  <span className="metric-label">{m.label}</span>
                </span>
                <span className="metric-value">
                  {checksLoading
                    ? <span className="skel" style={{ display: 'block', width: 44, height: 24, marginTop: 4 }} />
                    : m.value(stats, neverChecked.length)}
                </span>
                <span className="metric-foot">
                  <span>{m.foot}</span>
                  {m.filter && verdictFilter === m.filter && <span className="count-badge">on</span>}
                </span>
              </button>
            ))}
          </div>

          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Flags</span>
              <span className="count-badge">{filtered.length}</span>
              <div className="toolbar">
                <VerdictFilters value={verdictFilter} onChange={setVerdictFilter} />
                <label className="search">
                  <IconSearch />
                  <input
                    className="field-input"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search number, agent, booth…"
                  />
                </label>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th><th>Number</th><th>Verdict</th><th>Agent</th><th>Booth</th><th>Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {checksLoading && [0, 1, 2, 3].map(i => (
                    <tr key={`skel-${i}`}>
                      {[92, 118, 64, 96, 104, 220].map((w, j) => (
                        <td key={j}><span className="skel" style={{ display: 'block', width: w }} /></td>
                      ))}
                    </tr>
                  ))}
                  {!checksLoading && filtered.map(row => (
                    <tr key={row.id} className={selectedCheckId === row.id ? 'is-on' : undefined} onClick={() => openCheckOnMap(row)}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--mute)' }}>{formatCheckTime(row.checked_at)}</td>
                      <td className="mono">{row.phone_number}</td>
                      <td><VerdictPill verdict={row.verdict} /></td>
                      <td>
                        <span className="who">
                          <span className="who-mark">{initialsOf(displayAgentName(row.agent_name))}</span>
                          <span className="who-name">{displayAgentName(row.agent_name)}</span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-2)' }}>{row.agent_location}</td>
                      <td className="narration">{row.narration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!checksLoading && filtered.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><IconInbox /></div>
                {query || verdictFilter
                  ? 'No check matches this filter.'
                  : 'No checks yet. Run a simulator number from the bar.'}
              </div>
            )}
            {!checksLoading && filtered.length > 0 && (
              <div className="panel-foot">
                {filtered.length === checks.length
                  ? `All ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} shown.`
                  : `${filtered.length} of ${checks.length} checks shown.`}
              </div>
            )}
          </section>

          <div className="split">
            <section className="panel">
              <div className="panel-head">
                <span className="panel-title">Repeat numbers</span>
                <span className="count-badge">{repeats.length}</span>
              </div>
              {repeats.length === 0 && <div className="empty">No number has been checked twice.</div>}
              {repeats.map(([phone, n]) => (
                <div key={phone} className="list-row">
                  <span className="mono">{phone}</span>
                  <span className="meta">{n} checks</span>
                </div>
              ))}
            </section>
            <section className="panel">
              <div className="panel-head">
                <span className="panel-title">Agents with zero checks</span>
                <span className="count-badge">{neverChecked.length}</span>
              </div>
              {neverChecked.length === 0 && <div className="empty">Every registered agent has checked.</div>}
              {neverChecked.map(a => (
                <div key={a.id} className="list-row">
                  <span className="who">
                    <span className="who-mark">{initialsOf(a.name)}</span>
                    <span className="who-name">{a.name}</span>
                  </span>
                  <span className="meta"><IconPin /> {a.primary_location}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}

      {tab === 'where' && (
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
      )}
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
  value: (stats: FraudStats, neverChecked: number) => number
}[] = [
  { label: 'Checks', foot: 'all time', tone: ' is-quiet', filter: '', value: s => s.total },
  { label: 'Stop', foot: 'do not pay', tone: ' is-stop', filter: 'STOP', value: s => s.stop },
  { label: 'Caution', foot: 'ask a question', tone: ' is-caution', filter: 'CAUTION', value: s => s.caution },
  { label: 'Failed', foot: 'network error', tone: '', filter: 'CHECK_FAILED', value: s => s.failed },
  { label: 'Never checked', foot: 'registered agents', tone: ' is-quiet', filter: '', value: (_s, n) => n },
]

const FILTER_TONE: Record<string, string> = {
  STOP: ' chip-stop',
  CAUTION: ' chip-caution',
  SAFE: ' chip-safe',
}

function VerdictFilters({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {['', 'STOP', 'CAUTION', 'CHECK_FAILED', 'SAFE'].map(v => (
        <button
          key={v || 'all'}
          type="button"
          className={`chip${FILTER_TONE[v] ?? ''}${value === v ? ' is-on' : ''}`}
          onClick={() => onChange(v)}
        >
          {v === 'CHECK_FAILED' ? 'Failed' : (v || 'All')}
        </button>
      ))}
    </div>
  )
}
