'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
import { LngLatBounds } from 'maplibre-gl'
import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
  type MapRef,
} from '@/components/ui/map'
import { MapPoint, BaseMap } from '../types/sentry'
import { cn } from '@/lib/utils'

const LUSAKA: [number, number] = [28.2833, -15.4166]

const VERDICT_DOT: Record<string, string> = {
  STOP: 'bg-destructive ring-destructive/20',
  CAUTION: 'bg-warning ring-warning/20',
  SAFE: 'bg-success ring-success/20',
  CHECK_FAILED: 'bg-muted-foreground ring-muted',
}

function FlyToFocus({ point }: { point: MapPoint | null }) {
  const { map } = useMap()
  useEffect(() => {
    if (!point || !map) return
    map.flyTo({
      center: [point.longitude, point.latitude],
      zoom: 15,
      duration: 700,
    })
  }, [map, point])
  return null
}

function FitPoints({ points, enabled }: { points: MapPoint[]; enabled: boolean }) {
  const { map } = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!enabled || done.current || !map || points.length === 0) return
    done.current = true
    if (points.length === 1) {
      map.setCenter([points[0].longitude, points[0].latitude])
      map.setZoom(14)
      return
    }
    const bounds = new LngLatBounds(
      [points[0].longitude, points[0].latitude],
      [points[0].longitude, points[0].latitude],
    )
    for (const p of points) bounds.extend([p.longitude, p.latitude])
    map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 })
  }, [map, points, enabled])
  return null
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  const { map } = useMap()
  useEffect(() => {
    if (map) onReady?.()
  }, [map, onReady])
  return null
}

/**
 * MoMo booth map - mapcn (MapLibre) wrapper.
 * Theme-aware CARTO basemap, floating controls, verdict-colored markers.
 */
export default function Map({
  points,
  basemap,
  focusId,
  renderPopup,
  onSelect,
  onReady,
}: {
  points: MapPoint[]
  basemap: BaseMap
  focusId?: string | null
  renderPopup?: (point: MapPoint) => React.ReactNode
  onSelect?: (point: MapPoint) => void
  onReady?: () => void
}) {
  const { resolvedTheme } = useTheme()
  const mapRef = useRef<MapRef>(null)
  const theme = basemap === 'auto'
    ? (resolvedTheme === 'dark' ? 'dark' : 'light')
    : basemap === 'dark' ? 'dark' : 'light'

  const styles = useMemo(() => {
    if (basemap === 'satellite') {
      return {
        light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      }
    }
    return undefined
  }, [basemap])

  const focus = points.find(p => p.id === focusId) ?? null

  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl border border-border bg-muted/40">
      <MapcnMap
        ref={mapRef}
        className="sentry-map h-full w-full"
        theme={theme}
        styles={styles}
        center={LUSAKA}
        zoom={12}
      >
        <MapControls showZoom showCompass={false} />
        <ReadySignal onReady={onReady} />
        <FitPoints points={points} enabled={!focusId} />
        <FlyToFocus point={focus} />
        {points.map(point => (
          <MapMarker
            key={point.id}
            longitude={point.longitude}
            latitude={point.latitude}
            onClick={() => onSelect?.(point)}
          >
            <MarkerContent>
              <span
                className={cn(
                  'block size-3.5 rounded-full shadow-sm ring-4 transition',
                  VERDICT_DOT[point.verdict] ?? VERDICT_DOT.CHECK_FAILED,
                  point.id === focusId && 'scale-125',
                )}
              />
            </MarkerContent>
            <MarkerPopup className="min-w-[280px] max-w-[360px] p-0">
              {renderPopup ? renderPopup(point) : (
                <div className="p-4">
                  <div className="text-sm font-normal text-foreground">{point.label}</div>
                  <div className="text-xs text-muted-foreground">{point.sublabel}</div>
                </div>
              )}
            </MarkerPopup>
          </MapMarker>
        ))}
      </MapcnMap>
    </div>
  )
}
