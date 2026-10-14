import type { GeocodeResult } from "@red-link/shared/api";
import { env } from "../env.ts";
import { HttpError } from "../http.ts";

/**
 * Address search via OpenStreetMap Nominatim (owner decision: free, no API key).
 * Their usage policy requires an identifying User-Agent, at most 1 request per second and
 * caching, all handled here. Results are limited to India.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
const CACHE_MS = 24 * 60 * 60 * 1000;
let lastCall = 0;


interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; suburb?: string; state_district?: string; postcode?: string };
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim().replace(/\s+/g, " ");
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  // 1 request per second across the whole server.
  const wait = lastCall + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "5", countrycodes: "in" }).toString();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": `RedLink/1.0 (academic project${env.geocoderContact ? `; ${env.geocoderContact}` : ""})`,
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, "Address search needs an internet connection. You can still use your location or click on the map.");
  }
  if (!res.ok) throw new HttpError(502, "Address search is unavailable right now. Use your location or click on the map.");
  const items = (await res.json()) as NominatimItem[];
  const results = items.map((i) => ({
    label: i.display_name,
    lat: Number(i.lat),
    lng: Number(i.lon),
    city: i.address?.city ?? i.address?.town ?? i.address?.village ?? i.address?.state_district ?? null,
    pincode: i.address?.postcode && /^\d{6}$/.test(i.address.postcode) ? i.address.postcode : null,
  }));
  cache.set(key, { at: Date.now(), results });
  return results;
}
