// The Where tab: a booth rail beside the Lusaka map. Split out of the page so
// it can be rendered against fixture data without an owner session.

import React from 'react'
import dynamic from 'next/dynamic'

import { BASEMAPS, BaseMap, FraudCheck, MapPoint, Verdict, VERDICT_CLASS } from '../types/sentry'
import { FraudPopupCard } from './FraudPopupCard'
import { VerdictPill } from './VerdictPill'
import { IconPin } from './icons'
import { Select } from './Select'

const MapComponent = dynamic(() => import('./Map'), { ssr: false })

const STAT_TONES: { label: string; verdict: Verdict | null }[] = [
  { label: 'Booths', verdict: null },
  { label: 'Stop', verdict: 'STOP' },
  { label: 'Caution', verdict: 'CAUTION' },
  { label: 'Safe', verdict: 'SAFE' },
]

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
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 600 }}>{point.label}</div>
          <div className="hint">{point.sublabel}</div>
        </div>
      )
    }
    return (
      <div>
        <FraudPopupCard check={check} narration={check.narration || undefined} agentLabel={point.label} />
        <div style={{ padding: '0 16px 14px' }} className="hint">
          {point.checkCount ?? 1} {(point.checkCount ?? 1) === 1 ? 'check' : 'checks'} at this booth. Same rows as the Queue.
          <button type="button" className="btn-link" onClick={onOpenQueue} style={{ display: 'block', marginTop: 8 }}>
            Open in queue
          </button>
        </div>
      </div>
    )
  }, [checks, selectedCheckId, onOpenQueue])

  const handleSelect = React.useCallback((point: MapPoint) => onFocusPoint(point.id), [onFocusPoint])

  // The map is a lazy chunk. If it never lands, say so instead of showing a
  // dark rectangle that reads as a styling bug.
  const [mapReady, setMapReady] = React.useState(false)
  const [mapSlow, setMapSlow] = React.useState(false)
  const handleReady = React.useCallback(() => setMapReady(true), [])
  React.useEffect(() => {
    if (mapReady) return
    const id = window.setTimeout(() => setMapSlow(true), 6000)
    return () => window.clearTimeout(id)
  }, [mapReady])

  return (
    <div className="where">
      <aside className="where-rail">
        <div className="where-rail-head">
          <h1 className="page-title">Where</h1>
          <p className="page-sub">Latest check at each booth. Colour matches the Queue verdict.</p>
        </div>

        <div className="where-stats">
          {STAT_TONES.map((s, i) => {
            const active = s.verdict !== null && verdictFilter === s.verdict
            return (
              <button
                key={s.label}
                type="button"
                className={`where-stat${active ? ' is-on' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => onVerdictFilter(active ? '' : (s.verdict ?? ''))}
              >
                <span className={`where-stat-label ${s.verdict ? VERDICT_CLASS[s.verdict] : 'v-none'}`}>
                  {s.label}
                </span>
                <span className="where-stat-value">
                  {s.verdict === null ? points.length : counts[s.verdict]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="where-filters">{filters}</div>

        <section className="where-panel">
          <div className="panel-head">
            <span className="panel-title">Booths</span>
            <span className="count-badge">{points.length}</span>
            <span className="panel-note spacer">Click to fly</span>
          </div>
          <div className="where-scroll">
            {points.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><IconPin /></div>
                {verdictFilter
                  ? `No ${verdictFilter.replace('_', ' ').toLowerCase()} checks to place.`
                  : 'No checks yet. Run a simulator number from the bar.'}
              </div>
            )}
            {points.map(point => (
              <button
                key={point.id}
                type="button"
                className={`where-row${point.id === focusPointId ? ' is-on' : ''}`}
                onClick={() => onFocusPoint(point.id)}
              >
                <span className={`where-row-dot ${VERDICT_CLASS[point.verdict] ?? 'v-failed'}`} />
                <span className="where-row-copy">
                  <span className="where-row-name">{point.label}</span>
                  <span className="where-row-sub">{point.sublabel}</span>
                </span>
                <VerdictPill verdict={point.verdict} />
              </button>
            ))}
          </div>
        </section>

        <div className="where-foot">
          <div className="legend">
            {(['STOP', 'CAUTION', 'SAFE', 'CHECK_FAILED'] as Verdict[]).map(v => (
              <span key={v}>
                <span className={`swatch ${VERDICT_CLASS[v]}`} />
                {v === 'CHECK_FAILED' ? 'Failed' : v}
              </span>
            ))}
          </div>
          <span className="where-foot-count">{queueRows} queue {queueRows === 1 ? 'row' : 'rows'}</span>
        </div>
      </aside>

      <section className="where-map">
        <div className="map-basemap">
          <label className="map-basemap-label" htmlFor="basemap">Basemap</label>
          <Select
            id="basemap"
            aria-label="Basemap"
            className="select-sm"
            value={basemap}
            onChange={v => onBasemap(v as BaseMap)}
            options={BASEMAPS.map(b => ({ value: b.value, label: b.label }))}
          />
        </div>
        {!mapReady && (
          <div className="where-map-wait">
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
