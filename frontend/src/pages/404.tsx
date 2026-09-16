import Head from 'next/head'
import Link from 'next/link'
import { BrandLockup } from '../components/icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Custom404() {
  return (
    <>
      <Head><title>Not found - MoMo Sentry</title></Head>
      <div className="relative min-h-dvh overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%)]"
        />
        <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/"><BrandLockup /></Link>
            <ThemeToggle />
          </div>
          <Card className="border-border/70 bg-card/90 shadow-none backdrop-blur-sm">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">404</Badge>
              <CardTitle className="text-2xl tracking-tight">This page is not on the list.</CardTitle>
              <CardDescription>
                The route does not exist. Go back to the chooser, or open a surface that does.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/">Back to home</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/agent">Booth till</Link>
                </Button>
              </div>
              <Button asChild variant="link" className="h-auto self-start px-0">
                <Link href="/sentry">Operations</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
