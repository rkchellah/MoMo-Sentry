import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { Select } from '../components/Select'
import { getBoothLocations } from '../lib/fraudService'
import { BoothLocation } from '../types/sentry'
import { AuthShell, AuthError, AuthInput, PasswordField, AuthField, AuthActions, AuthForm } from '../components/AuthShell'
import { Button } from '@/components/ui/button'

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
      title="Create account - MoMo Sentry"
      heading="Create a till account."
      lede="Booth agents only. Operations is a separate login."
    >
      {error && <AuthError>{error}</AuthError>}
      <form onSubmit={handleSubmit}>
        <AuthForm>
          <AuthField label="Name" htmlFor="reg-name">
            <AuthInput id="reg-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
          </AuthField>
          <AuthField label="Email" htmlFor="reg-email">
            <AuthInput id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </AuthField>
          <AuthField label="Password" htmlFor="reg-password">
            <PasswordField id="reg-password" value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(v => !v)} autoComplete="new-password" />
          </AuthField>
          <AuthField label="Phone" htmlFor="reg-phone">
            <AuthInput id="reg-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" required />
          </AuthField>
          <AuthField label="Booth">
            <Select
              aria-label="Primary booth"
              value={location}
              onChange={setLocation}
              options={boothLocations.map(l => ({ value: l.name, label: l.name }))}
              placeholder="Select booth"
            />
          </AuthField>
        </AuthForm>
        <AuthActions
          busy={loading}
          label="Continue"
          aside={(
            <Button asChild variant="link">
              <Link href="/agent">Already have an account?</Link>
            </Button>
          )}
        />
      </form>
    </AuthShell>
  )
}
