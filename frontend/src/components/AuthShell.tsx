import Head from 'next/head'
import { ReactNode } from 'react'
import { IconAlert, IconEnter, IconEye, IconEyeOff } from './icons'

export function AuthShell({
  title,
  heading,
  children,
}: {
  title: string
  heading: string
  children: ReactNode
}) {
  return (
    <>
      <Head><title>{title}</title></Head>
      <div className="auth-page">
        <div className="auth-center">
          <h1>{heading}</h1>
          {children}
        </div>
      </div>
    </>
  )
}

export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="auth-row">
      <span className="auth-row-label">{label}</span>
      {children}
    </div>
  )
}

export function AuthActions({ aside, busy, label }: {
  aside: ReactNode
  busy?: boolean
  label: string
}) {
  return (
    <div className="auth-actions">
      <div className="auth-aside-link">{aside}</div>
      <button className="auth-continue" type="submit" disabled={busy}>
        {busy ? '…' : label}
        {!busy && <IconEnter />}
      </button>
    </div>
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

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div className="auth-notice" role="status">
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
        className="auth-input"
        type={props.show ? 'text' : 'password'}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
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
