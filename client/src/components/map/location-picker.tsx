import { CrosshairIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeocodeResult } from "@red-link/shared/api";
import type { LatLng } from "@red-link/shared/domain/geo";
import { api, ApiError } from "@/lib/api";

// Leaflet is loaded only when a map is shown (keeps the first page load small).
const LocationPickerMap = lazy(() => import("./location-picker-map"));

/**
 * Pick a location three ways: address search (OpenStreetMap, owner decision), browser GPS,
 * or clicking the map (spec decision #8). GPS and map clicks work offline; search needs internet.
 */
export function LocationPicker({
  value,
  onChange,
  onAddressPick,
  invalid,
  describedBy,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  /** Called when an address search result is chosen, so forms can fill city / pincode. */
  onAddressPick?: (r: GeocodeResult) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[] | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This browser can't share its location. Search for an address or click on the map.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location set");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Search for an address or click on the map."
            : "Couldn't get your location. Search for an address or click on the map.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function search() {
    if (query.trim().length < 3) {
      toast.error("Type at least 3 characters of the address.");
      return;
    }
    setSearching(true);
    try {
      const { results: found } = await api<{ results: GeocodeResult[] }>(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      setResults(found);
      if (found.length === 0) toast.error("No matching places found. Try adding the area or city.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Address search failed.");
    } finally {
      setSearching(false);
    }
  }

  function choose(r: GeocodeResult) {
    onChange({ lat: r.lat, lng: r.lng });
    onAddressPick?.(r);
    setResults(null);
    toast.success("Location set from address");
  }

  return (
    <div className="flex flex-col gap-2" aria-describedby={describedBy} role="group" aria-label="Location">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search an address, e.g. Vidyavihar station"
          aria-label="Search for an address"
        />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
          <SearchIcon />
          {searching ? "Searching…" : "Search"}
        </Button>
      </div>
      {results && results.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border" aria-label="Address results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => choose(r)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
          <CrosshairIcon />
          {locating ? "Locating…" : "Use my location"}
        </Button>
        <span className="text-sm text-muted-foreground">or click on the map</span>
      </div>
      <div className={invalid ? "rounded-lg ring-2 ring-destructive" : undefined}>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <LocationPickerMap value={value} onPick={onChange} onTileError={() => setTilesFailed(true)} />
        </Suspense>
      </div>
      {tilesFailed ? (
        <p className="text-xs text-muted-foreground">
          Map images couldn&apos;t load (you may be offline). You can still use your location or click on the map.
        </p>
      ) : null}
      <p className="flex items-center gap-1 text-sm" aria-live="polite">
        <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
        {value ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "No location selected yet"}
      </p>
    </div>
  );
}
