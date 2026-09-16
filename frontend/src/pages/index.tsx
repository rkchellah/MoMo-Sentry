import Head from 'next/head'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { BrandLockup } from '../components/icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function Home() {
  return (
    <>
      <Head><title>MoMo Sentry</title></Head>
      <div className="relative min-h-dvh overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--muted-foreground)_12%,transparent),transparent_55%)]"
        />
        <div className="relative mx-auto grid min-h-dvh w-full lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
            <div className="mb-8 flex items-center justify-between gap-4">
              <BrandLockup />
              <ThemeToggle />
            </div>
            <Card className="max-w-lg border-border/70 bg-card/90 shadow-none backdrop-blur-sm">
              <CardHeader className="gap-3">
                <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                  Check the SIM before you pay out.
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  A lightweight booth till for product teams - CAMARA SIM Swap, Device Swap, and Device Status.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/agent">Booth till</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/sentry">Operations</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
          <aside className="relative hidden min-h-dvh overflow-hidden border-l border-border lg:block">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklch,var(--muted-foreground)_10%,transparent),transparent_50%)]"
            />
            <div className="relative flex h-full flex-col justify-end gap-6 p-12 xl:px-16">
              <Badge variant="secondary" className="w-fit">
                <ShieldCheck data-icon="inline-start" />
                Surfaces
              </Badge>
              <div className="flex flex-col gap-3 text-xl font-normal tracking-tight text-foreground">
                <p>/agent - booth till</p>
                <p>/sentry - operations</p>
                <p>Where - Lusaka map</p>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Same signals. Two screens. One decision before cash leaves the booth.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
