import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_MAP_CENTER } from "@red-link/shared/domain/constants";
import type { LatLng } from "@red-link/shared/domain/geo";

const DEFAULT_CENTER: LatLng = DEFAULT_MAP_CENTER;

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [map, value]);
  return null;
}

export default function LocationPickerMap({
  value,
  onPick,
  onTileError,
}: {
  value: LatLng | null;
  onPick: (p: LatLng) => void;
  onTileError: () => void;
}) {
  const center = value ?? DEFAULT_CENTER;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg border bg-muted"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileError }}
      />
      <ClickHandler onPick={onPick} />
      <Recenter value={value} />
      {value ? (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={10}
          pathOptions={{ color: "#B91C1C", fillColor: "#B91C1C", fillOpacity: 0.6, weight: 2 }}
        />
      ) : null}
    </MapContainer>
  );
}
