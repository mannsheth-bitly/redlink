import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { LatLng } from "@red-link/shared/domain/geo";

export interface MapGroup {
  key: string;
  at: LatLng;
  labels: string[];
}

/**
 * Search results on a map. Donor positions arrive already snapped to a ~1 km grid by the
 * server (spec 5.6 / owner decision); donors in the same square share one pin with a count.
 */
export default function ResultsMap({
  centre,
  radiusKm,
  groups,
  onTileError,
}: {
  centre: LatLng;
  radiusKm: number;
  groups: MapGroup[];
  onTileError: () => void;
}) {
  const zoom = radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 25 ? 11 : 10;
  return (
    <MapContainer
      key={`${centre.lat},${centre.lng},${radiusKm}`}
      center={[centre.lat, centre.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-[420px] w-full rounded-xl border bg-muted"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileError }}
      />
      <Circle
        center={[centre.lat, centre.lng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: "#B91C1C", weight: 1, fillOpacity: 0.04, dashArray: "4 4" }}
      />
      <CircleMarker
        center={[centre.lat, centre.lng]}
        radius={7}
        pathOptions={{ color: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 1, weight: 2 }}
      >
        <Tooltip>Search centre</Tooltip>
      </CircleMarker>
      {groups.map((g) => (
        <CircleMarker
          key={g.key}
          center={[g.at.lat, g.at.lng]}
          radius={8 + Math.min(10, (g.labels.length - 1) * 2)}
          pathOptions={{ color: "#B91C1C", fillColor: "#B91C1C", fillOpacity: 0.55, weight: 2 }}
        >
          <Tooltip>
            <strong>
              {g.labels.length} donor{g.labels.length === 1 ? "" : "s"} in this area (~1 km)
            </strong>
            <br />
            {g.labels.slice(0, 5).join(", ")}
            {g.labels.length > 5 ? ` +${g.labels.length - 5} more` : ""}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
