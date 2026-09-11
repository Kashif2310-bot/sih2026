import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import type { CompetitorPoi } from '../lib/geo'

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const CompetitorIcon = L.divIcon({
  className: '',
  html: `<span style="display:block;width:10px;height:10px;border-radius:50%;background:#c45c26;border:2px solid #fff;box-shadow:0 0 0 1px #c45c26"></span>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

function Recenter({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], radiusKm <= 6 ? 13 : 12)
  }, [lat, lng, radiusKm, map])
  return null
}

export function VillageMap({
  lat,
  lng,
  name,
  radiusKm,
  competitors = [],
}: {
  lat: number
  lng: number
  name: string
  radiusKm: number
  competitors?: CompetitorPoi[]
}) {
  const r = radiusKm * 1000
  return (
    <MapContainer center={[lat, lng]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
      <Recenter lat={lat} lng={lng} radiusKm={radiusKm} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[lat, lng]}
        radius={r}
        pathOptions={{ color: '#1f6b4f', fillColor: '#1f6b4f', fillOpacity: 0.12 }}
      />
      <Circle
        center={[lat, lng]}
        radius={Math.min(10_000, r * 1.4)}
        pathOptions={{ color: '#3d7ea6', fillColor: '#3d7ea6', fillOpacity: 0.04 }}
      />
      <Marker position={[lat, lng]}>
        <Popup>{name}</Popup>
      </Marker>
      {competitors.slice(0, 60).map((c) => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={CompetitorIcon}>
          <Popup>{c.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
