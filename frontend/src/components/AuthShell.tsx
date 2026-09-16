import Head from 'next/head'
import Link from 'next/link'
import { type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { BrandLockup } from './icons'
import { ThemeToggle } from './ThemeToggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const SURFACES = [
  { href: '/agent', label: 'Booth till' },
  { href: '/sentry', label: 'Operations queue' },
  { href: '/sentry', label: 'Lusaka map' },
] as const

export function AuthShell({
  title,
  heading,
  lede,
  children,
}: {
  title: string
  heading: string
  lede?: string
  children: ReactNode
}) {
  return (
    <>
      <Head><title>{title}</title></Head>
      <div className="relative min-h-dvh overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--muted-foreground)_12%,transparent),transparent_55%)]"
        />
        <div className="relative mx-auto grid min-h-dvh w-full lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Link href="/" className="inline-flex">
                <BrandLockup />
              </Link>
              <ThemeToggle />
            </div>

            <Card className="max-w-md border-border/70 bg-card/90 shadow-none backdrop-blur-sm">
              <CardHeader className="gap-2">
                <CardTitle className="text-2xl tracking-tight sm:text-3xl">{heading}</CardTitle>
                {lede && <CardDescription className="text-sm leading-relaxed">{lede}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-col gap-5 [&_form]:flex [&_form]:flex-col [&_form]:gap-5">
                {children}
              </CardContent>
            </Card>
          </div>

          <aside className="relative hidden min-h-dvh overflow-hidden border-l border-border lg:block">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklch,var(--muted-foreground)_10%,transparent),transparent_50%)]"
            />
            <div className="relative flex h-full flex-col justify-between p-12 xl:px-16">
              <div className="flex flex-col gap-5">
                <Badge variant="secondary" className="w-fit">
                  <ShieldCheck data-icon="inline-start" />
                  MoMo Sentry
                </Badge>
                <h2 className="max-w-sm text-3xl font-normal tracking-tight text-foreground">
                  CAMARA SIM Swap, Device Swap, and Device Status - before payout.
                </h2>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Check the network signals first. Release cash only when the number looks clean.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <Separator />
                <ul className="flex flex-col gap-1">
                  {SURFACES.map(item => (
                    <li key={item.label}>
                      <Button asChild variant="ghost" className="h-9 w-full justify-start px-2">
                        <Link href={item.href}>
                          <span className="text-primary">/</span>
                          {item.label}
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

export function AuthField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <Field>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </Field>
  )
}

export function AuthInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  return <Input {...props} />
}

export function AuthActions({
  aside,
  busy,
  label,
}: {
  aside: ReactNode
  busy?: boolean
  label: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : null}
        {busy ? 'Working…' : label}
      </Button>
      <div className="flex flex-wrap items-center justify-center gap-1 text-center [&_a]:inline-flex [&_button]:inline-flex">
        {aside}
      </div>
    </div>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function PasswordField(props: {
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggle: () => void
  autoComplete?: string
  placeholder?: string
  id?: string
}) {
  return (
    <InputGroup>
      <InputGroupInput
        id={props.id}
        type={props.show ? 'text' : 'password'}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder ?? 'Password'}
        required
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={props.show ? 'Hide password' : 'Show password'}
          onClick={props.onToggle}
        >
          {props.show ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export function AuthForm({ children }: { children: ReactNode }) {
  return <FieldGroup>{children}</FieldGroup>
}

export function authLinkClass(className?: string) {
  return cn('text-sm text-primary underline-offset-2 hover:underline', className)
}
