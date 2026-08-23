import 'leaflet/dist/leaflet.css'
import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap, Pane } from 'react-leaflet'
import L from 'leaflet'

import { MapPoint, BaseMap, VERDICT_RADIUS } from '../types/sentry'

const renderer = L.canvas({ padding: 0.5 })
const LUSAKA_CENTER: [number, number] = [-15.4166, 28.2833]

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

type Theme = 'light' | 'dark'
/** What the basemap actually resolves to once "auto" has followed the theme. */
type Base = 'light' | 'dark' | 'satellite'

// Keyless basemaps. These keep the stage from being a blank rectangle when the
// Mapbox token is missing or rejected, and they are what the satellite option
// uses in every case.
const FALLBACK_TILES: Record<Base, { url: string; attr: string; maxZoom: number }> = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attr: '© OpenStreetMap © CARTO',
    maxZoom: 19,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© OpenStreetMap © CARTO',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagery © Esri',
    maxZoom: 18,
  },
}

const MAPBOX_STYLE: Record<Base, string> = {
  light: 'mapbox/light-v11',
  dark: 'mapbox/dark-v11',
  satellite: 'mapbox/satellite-streets-v12',
}

// Booth dots read as a greyscale ramp: the worse the verdict, the more it
// contrasts with the basemap. Leaflet paints these on canvas, so they have to
// be literal colours rather than CSS custom properties.
const DOT: Record<Base, Record<string, string>> = {
  light: { STOP: '#111317', CAUTION: '#565c66', SAFE: '#ffffff', CHECK_FAILED: '#b6bcc4' },
  dark: { STOP: '#ffffff', CAUTION: '#b9c0c9', SAFE: '#3b424b', CHECK_FAILED: '#6b737d' },
  satellite: { STOP: '#ffffff', CAUTION: '#c9ced5', SAFE: '#3b424b', CHECK_FAILED: '#8a919a' },
}
const HALO: Record<Base, { rest: string; focus: string }> = {
  light: { rest: '#ffffff', focus: '#111317' },
  dark: { rest: '#0f1115', focus: '#ffffff' },
  satellite: { rest: '#111317', focus: '#ffffff' },
}

/** Tracks the data-theme attribute so the basemap follows the toggle. */
function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' || document.documentElement.getAttribute('data-theme') !== 'dark'
      ? 'light'
      : 'dark',
  )
  useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return theme
}

// Leaflet measures its container once at mount. The Where grid settles a frame
// later and the rail collapses on resize, so watch the box rather than guess.
function KeepSized() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const resize = () => map.invalidateSize({ animate: false })
    const raf = window.requestAnimationFrame(resize)
    const id = window.setTimeout(resize, 240)
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(id)
      ro.disconnect()
    }
  }, [map])
  return null
}

// Lets the page distinguish "map is loading" from "map never arrived".
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const map = useMap()
  useEffect(() => { onReady?.() }, [map, onReady])
  return null
}

function CursorController() {
  const map = useMap()
  useEffect(() => {
    const onOpen = () => { map.getContainer().style.cursor = 'default' }
    const onClose = () => { map.getContainer().style.cursor = '' }
    map.on('popupopen', onOpen)
    map.on('popupclose', onClose)
    return () => { map.off('popupopen', onOpen); map.off('popupclose', onClose) }
  }, [map])
  return null
}

function FlyToFocus({ point }: { point: MapPoint | null }) {
  const map = useMap()
  useEffect(() => {
    if (!point) return
    map.flyTo([point.latitude, point.longitude], 16, { duration: 0.55 })
  }, [map, point])
  return null
}

// First paint should frame the booths that exist, not an arbitrary zoom 13.
function FitPoints({ points, enabled }: { points: MapPoint[]; enabled: boolean }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!enabled || done.current || points.length === 0) return
    done.current = true
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15)
      return
    }
    map.fitBounds(L.latLngBounds(points.map(p => [p.latitude, p.longitude] as [number, number])), {
      padding: [64, 64],
      maxZoom: 15,
    })
  }, [map, points, enabled])
  return null
}

function FocusedMarker({
  point,
  focused,
  base,
  renderPopup,
  onSelect,
}: {
  point: MapPoint
  focused: boolean
  base: Base
  renderPopup?: (point: MapPoint) => React.ReactNode
  onSelect?: (point: MapPoint) => void
}) {
  const ref = useRef<L.CircleMarker>(null)
  useEffect(() => {
    if (focused) ref.current?.openPopup()
  }, [focused])

  return (
    <CircleMarker
      ref={ref}
      center={[point.latitude, point.longitude]}
      radius={(VERDICT_RADIUS[point.verdict] ?? 5) + (focused ? 6 : 3)}
      pathOptions={{
        color: focused ? HALO[base].focus : HALO[base].rest,
        fillColor: DOT[base][point.verdict] ?? DOT[base].CHECK_FAILED,
        fillOpacity: 1,
        weight: focused ? 2.5 : 2,
      }}
      bubblingMouseEvents={false}
      renderer={renderer}
      eventHandlers={{ click: () => onSelect?.(point) }}
    >
      <Popup className="sentry-popup" maxWidth={400} minWidth={300}>
        {renderPopup
          ? renderPopup(point)
          : <div style={{ padding: 16 }}>{point.label}</div>}
      </Popup>
    </CircleMarker>
  )
}

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
  const [tilesFailed, setTilesFailed] = useState(false)
  const theme = useTheme()
  const base: Base = basemap === 'auto' ? theme : basemap
  const useFallback = !MAPBOX_TOKEN || tilesFailed
  const fallback = FALLBACK_TILES[base]

  const focus = points.find(p => p.id === focusId) ?? null
  const markers = React.useMemo(() => (
    points.map((point, i) => (
      <FocusedMarker
        key={point.id || i}
        point={point}
        focused={point.id === focusId}
        base={base}
        renderPopup={renderPopup}
        onSelect={onSelect}
      />
    ))
  ), [points, focusId, base, renderPopup, onSelect])

  return (
    <MapContainer
      center={LUSAKA_CENTER}
      zoom={13}
      className="sentry-map"
      zoomControl={false}
      preferCanvas
    >
      <ZoomControl position="bottomright" />
      {useFallback ? (
        <TileLayer
          key={`fallback-${base}`}
          url={fallback.url}
          attribution={fallback.attr}
          maxZoom={fallback.maxZoom}
        />
      ) : (
        <TileLayer
          key={base}
          url={`https://api.mapbox.com/styles/v1/${MAPBOX_STYLE[base]}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution="© Mapbox © OpenStreetMap"
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
      )}
      <Pane name="checkPane" style={{ zIndex: 450 }}>{markers}</Pane>
      <ReadySignal onReady={onReady} />
      <KeepSized />
      <CursorController />
      <FitPoints points={points} enabled={!focusId} />
      <FlyToFocus point={focus} />
    </MapContainer>
  )
}
