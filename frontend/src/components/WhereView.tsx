// The Where tab: a booth rail beside the Lusaka map. Split out of the page so
// it can be rendered against fixture data without an owner session.

import React from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, MapPin, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { BASEMAPS, BaseMap, FraudCheck, MapPoint, Verdict } from '../types/sentry'
import { FraudPopupCard } from './FraudPopupCard'
import { VerdictPill } from './VerdictPill'
import { Select } from './Select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const MapComponent = dynamic(() => import('./Map'), { ssr: false })

const PANEL_KEY = 'momo-where-panel-open'

const STAT_TONES: { label: string; verdict: Verdict | null; tone?: string }[] = [
  { label: 'Booths', verdict: null },
  { label: 'Stop', verdict: 'STOP', tone: 'text-destructive' },
  { label: 'Caution', verdict: 'CAUTION', tone: 'text-warning' },
  { label: 'Safe', verdict: 'SAFE', tone: 'text-success' },
]

const DOT_TONE: Record<Verdict, string> = {
  STOP: 'bg-destructive',
  CAUTION: 'bg-warning',
  SAFE: 'bg-success',
  CHECK_FAILED: 'bg-muted-foreground',
}

export interface WhereViewProps {
  points: MapPoint[]
  checks: FraudCheck[]
  basemap: BaseMap
  onBasemap: (value: BaseMap) => void
  verdictFilter: string
  onVerdictFilter: (value: string) => void
  focusPointId: string | null
  onFocusPoint: (pointId: string) => void
  selectedCheckId: string | null
  queueRows: number
  onOpenQueue: () => void
  filters: React.ReactNode
}

export function WhereView({
  points, checks, basemap, onBasemap, verdictFilter, onVerdictFilter,
  focusPointId, onFocusPoint, selectedCheckId, queueRows, onOpenQueue, filters,
}: WhereViewProps) {
  const [panelOpen, setPanelOpen] = React.useState(true)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PANEL_KEY)
      if (stored === '0') setPanelOpen(false)
      if (stored === '1') setPanelOpen(true)
    } catch {
      /* ignore */
    }
  }, [])

  const togglePanel = React.useCallback(() => {
    setPanelOpen(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(PANEL_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const counts = React.useMemo(() => {
    const c: Record<Verdict, number> = { STOP: 0, CAUTION: 0, SAFE: 0, CHECK_FAILED: 0 }
    for (const p of points) c[p.verdict] = (c[p.verdict] ?? 0) + 1
    return c
  }, [points])

  const renderPopup = React.useCallback((point: MapPoint) => {
    const group = checks.filter(c => `${c.agent_id || 'none'}::${c.agent_location || 'Unknown'}` === point.id)
    const check = group.find(c => c.id === selectedCheckId) ?? group[0]
    if (!check) {
      return (
        <div className="flex flex-col gap-1 p-4">
          <p className="text-sm font-normal text-foreground">{point.label}</p>
          <p className="text-xs font-normal text-muted-foreground">{point.sublabel}</p>
        </div>
      )
    }
    return (
      <FraudPopupCard
        check={check}
        narration={check.narration || undefined}
        agentLabel={point.label}
        checkCount={point.checkCount}
        onOpenQueue={onOpenQueue}
      />
    )
  }, [checks, selectedCheckId, onOpenQueue])

  const handleSelect = React.useCallback((point: MapPoint) => onFocusPoint(point.id), [onFocusPoint])

  const [mapReady, setMapReady] = React.useState(false)
  const [mapSlow, setMapSlow] = React.useState(false)
  const handleReady = React.useCallback(() => setMapReady(true), [])
  React.useEffect(() => {
    if (mapReady) return
    const id = window.setTimeout(() => setMapSlow(true), 6000)
    return () => window.clearTimeout(id)
  }, [mapReady])

  return (
    <div className="relative flex min-h-[calc(100dvh-4.5rem)] flex-col lg:flex-row">
      {/* Collapsed strip (desktop) */}
      <aside
        className={cn(
          'z-20 flex shrink-0 flex-col border-border bg-background transition-[width] duration-200 ease-out',
          panelOpen
            ? 'w-full border-b lg:w-[22rem] lg:border-r lg:border-b-0'
            : 'hidden lg:flex lg:w-11 lg:border-r',
        )}
      >
        {!panelOpen ? (
          <div className="flex h-full flex-col items-center gap-3 py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              onClick={togglePanel}
              aria-label="Expand Where panel"
              title="Expand Where"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
            <span
              className="mt-2 text-[10px] font-normal uppercase tracking-widest text-muted-foreground"
              style={{ writingMode: 'vertical-rl' }}
            >
              Where
            </span>
            <Badge variant="secondary" className="mt-auto h-6 min-w-6 justify-center px-1.5 text-[10px]">
              {points.length}
            </Badge>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 px-4 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-normal tracking-tight text-foreground">Where</h1>
                <p className="mt-1 text-sm font-normal text-muted-foreground">
                  Latest check at each booth. Colour matches the Queue verdict.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 hidden size-8 shrink-0 rounded-lg lg:inline-flex"
                onClick={togglePanel}
                aria-label="Collapse Where panel"
                title="Collapse Where"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4 lg:grid-cols-2">
              {STAT_TONES.map(s => {
                const active = s.verdict !== null && verdictFilter === s.verdict
                return (
                  <Card
                    key={s.label}
                    size="sm"
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'cursor-pointer py-2.5 transition hover:bg-muted/50',
                      active && 'ring-2 ring-ring',
                    )}
                    onClick={() => onVerdictFilter(active ? '' : (s.verdict ?? ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onVerdictFilter(active ? '' : (s.verdict ?? ''))
                      }
                    }}
                  >
                    <CardContent className="px-3 py-0">
                      <p className={cn('text-[10px] font-normal uppercase tracking-wide text-muted-foreground', s.tone)}>
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-base font-normal tabular-nums text-foreground">
                        {s.verdict === null ? points.length : counts[s.verdict]}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="w-full min-w-0 overflow-x-auto px-4 pb-3">{filters}</div>

            <Separator />

            <Card className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent shadow-none ring-0">
              <CardHeader className="flex flex-row items-center gap-2 px-4 py-3">
                <CardTitle className="text-sm font-normal">Booths</CardTitle>
                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 font-normal">
                  {points.length}
                </Badge>
                <CardDescription className="ml-auto text-xs font-normal">Click to fly</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-0 pb-0">
                <ScrollArea className="h-full max-h-[min(420px,45vh)] lg:max-h-none lg:h-[calc(100dvh-28rem)]">
                  {points.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm font-normal text-muted-foreground">
                      <MapPin className="size-5" />
                      {verdictFilter
                        ? `No ${verdictFilter.replace('_', ' ').toLowerCase()} checks to place.`
                        : 'No checks yet. Run a simulator number from the bar.'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    {points.map(point => (
                      <Button
                        key={point.id}
                        type="button"
                        variant="ghost"
                        className={cn(
                          'h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal',
                          point.id === focusPointId && 'bg-muted',
                        )}
                        onClick={() => onFocusPoint(point.id)}
                      >
                        <span
                          className={cn(
                            'mt-0.5 size-2 shrink-0 rounded-full',
                            DOT_TONE[point.verdict] ?? DOT_TONE.CHECK_FAILED,
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-normal text-foreground">{point.label}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">{point.sublabel}</span>
                        </span>
                        <VerdictPill verdict={point.verdict} />
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-xs font-normal text-muted-foreground">
                {(['STOP', 'CAUTION', 'SAFE', 'CHECK_FAILED'] as Verdict[]).map(v => (
                  <span key={v} className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full', DOT_TONE[v])} />
                    {v === 'CHECK_FAILED' ? 'Failed' : v}
                  </span>
                ))}
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                {queueRows} queue {queueRows === 1 ? 'row' : 'rows'}
              </span>
            </div>
          </>
        )}
      </aside>

      <section className="relative min-h-[50vh] flex-1 bg-muted/20 lg:min-h-0">
        {/* Mobile: toggle when panel stacks above map */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg bg-background/95 font-normal shadow-sm backdrop-blur"
            onClick={togglePanel}
            aria-expanded={panelOpen}
          >
            {panelOpen ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {panelOpen ? 'Hide list' : 'Booths'}
          </Button>
        </div>

        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg border border-border bg-background/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
          <Label htmlFor="basemap" className="text-xs font-normal text-muted-foreground">Basemap</Label>
          <Select
            id="basemap"
            aria-label="Basemap"
            size="sm"
            className="w-[140px]"
            value={basemap}
            onChange={v => onBasemap(v as BaseMap)}
            options={BASEMAPS.map(b => ({ value: b.value, label: b.label }))}
          />
        </div>
        {!mapReady && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background/60 text-sm font-normal text-muted-foreground">
            {mapSlow
              ? 'The map did not load. Reload the page.'
              : 'Loading Lusaka…'}
          </div>
        )}
        <MapComponent
          points={points}
          basemap={basemap}
          focusId={focusPointId}
          onSelect={handleSelect}
          renderPopup={renderPopup}
          onReady={handleReady}
        />
      </section>
    </div>
  )
}
