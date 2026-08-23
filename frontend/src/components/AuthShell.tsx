import Head from 'next/head'
import { ReactNode } from 'react'
import { BrandLockup, IconAlert, IconEye, IconEyeOff } from './icons'
import { SandboxBanner } from './SandboxBanner'
import { ThemeToggle } from './ThemeToggle'

export function AuthShell({
  title,
  asideTitle,
  asideBody,
  children,
}: {
  title: string
  asideTitle?: string
  asideBody?: string
  children: ReactNode
}) {
  return (
    <>
      <Head><title>{title}</title></Head>
      <div className="auth-page">
        <SandboxBanner />
        <div className="auth-body">
          <aside className="auth-aside">
            <div>
              <BrandLockup invert />
              <h2>{asideTitle ?? 'SIM-swap checks for Lintel Zambia booths.'}</h2>
              <p>{asideBody ?? 'Verdicts come from the Nokia network API. The written narration explains a verdict, it never sets one.'}</p>
            </div>
            <p className="aside-foot">
              <span className="dot-live" />
              Sandbox · +999 simulator numbers
            </p>
          </aside>
          <div className="auth-main">
            <div className="auth-card">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -12 }}>
                <ThemeToggle />
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div className="auth-error" role="alert">
      <IconAlert />
      <span>{children}</span>
    </div>
  )
}

export function PasswordField(props: {
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggle: () => void
  autoComplete?: string
}) {
  return (
    <div className="pwd-wrap">
      <input
        className="field-input"
        type={props.show ? 'text' : 'password'}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete={props.autoComplete}
        style={{ paddingRight: 46 }}
        required
      />
      <button
        type="button"
        onClick={props.onToggle}
        className="pwd-toggle"
        aria-label={props.show ? 'Hide password' : 'Show password'}
      >
        {props.show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}
