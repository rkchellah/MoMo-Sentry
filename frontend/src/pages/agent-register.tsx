import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { BrandLockup, IconArrow } from '../components/icons'
import { Select } from '../components/Select'
import { getBoothLocations } from '../lib/fraudService'
import { BoothLocation } from '../types/sentry'
import { AuthShell, AuthError, PasswordField } from '../components/AuthShell'

export default function AgentRegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [boothLocations, setBoothLocations] = useState<BoothLocation[]>([])
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getBoothLocations().then(locs => {
      setBoothLocations(locs)
      if (locs[0]) setLocation(locs[0].name)
    }).catch(console.error)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: signErr } = await supabase.auth.signUp({ email, password })
    if (signErr || !data?.user) {
      setError(signErr?.message ?? 'Registration failed')
      setLoading(false)
      return
    }
    const { error: insertErr } = await supabase
      .from('booth_agents')
      .insert({ user_id: data.user.id, name, phone, primary_location: location })
    if (insertErr) {
      setError(insertErr.message)
      setLoading(false)
      return
    }
    await supabase.from('momo_profiles').insert({ user_id: data.user.id, role: 'agent' })
    router.push('/agent')
  }

  return (
    <AuthShell
      title="Register agent — Lintel Zambia"
      asideTitle="Register a booth agent."
      asideBody="Register against a Lintel Zambia site. The owner sees your checks in the queue."
    >
      <BrandLockup />
      <h1>Register as an agent</h1>
      <p className="lede">Your account can only write agent checks. Owners are not created here.</p>
      {error && <AuthError>{error}</AuthError>}
      <form onSubmit={handleSubmit}>
        <label className="field-label">Full name</label>
        <input className="field-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Chanda Mwale" required />
        <label className="field-label" style={{ marginTop: 14 }}>Email</label>
        <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@lintel.zm" required />
        <label className="field-label" style={{ marginTop: 14 }}>Password</label>
        <PasswordField value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(v => !v)} autoComplete="new-password" />
        <label className="field-label" style={{ marginTop: 14 }}>Phone</label>
        <input className="field-input mono" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="+2609…" required />
        <label className="field-label" style={{ marginTop: 14 }}>Primary booth</label>
        <Select
          aria-label="Primary booth"
          value={location}
          onChange={setLocation}
          options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
          placeholder="Select booth"
        />
        <button className="btn" type="submit" disabled={loading} style={{ marginTop: 22, width: '100%' }}>
          {loading
            ? <><span className="spinner spinner-inline" /> Creating…</>
            : <>Create agent account <IconArrow /></>}
        </button>
      </form>
      <p className="auth-foot">Already registered? <Link href="/agent">Sign in</Link></p>
    </AuthShell>
  )
}
