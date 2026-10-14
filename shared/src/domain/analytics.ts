// Admin analytics (spec 8 /admin). Pure functions so they can be unit-tested.
// Calendar days and months are counted in India Standard Time (UTC+5:30, no DST).

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** "2026-10-14" — the IST calendar day of an instant. */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant the current IST calendar month began (e.g. 1 Oct 00:00 IST). */
export function startOfIstMonth(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** The instant the IST day `daysBack` days before today began. */
export function startOfIstDay(now: Date, daysBack = 0): Date {
  const key = istDayKey(new Date(now.getTime() - daysBack * DAY_MS));
  return new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_OFFSET_MS);
}

/**
 * Fulfilment rate = fulfilled ÷ closed requests (fulfilled + cancelled + expired), in %.
 * Open requests are left out because their outcome isn't known yet. Null when nothing has closed.
 */
export function fulfilmentRate(counts: { fulfilled: number; cancelled: number; expired: number }): number | null {
  const closed = counts.fulfilled + counts.cancelled + counts.expired;
  if (closed === 0) return null;
  return Math.round((counts.fulfilled / closed) * 1000) / 10;
}

/**
 * Average minutes from a request being created to its first donor acceptance. Each request
 * contributes once (its earliest acceptance); requests nobody accepted are left out.
 */
export function averageFirstAcceptanceMinutes(
  requests: { createdAt: Date; firstAcceptedAt: Date | null }[],
): number | null {
  const waits = requests
    .filter((r): r is { createdAt: Date; firstAcceptedAt: Date } => r.firstAcceptedAt !== null)
    .map((r) => Math.max(0, r.firstAcceptedAt.getTime() - r.createdAt.getTime()) / 60_000);
  if (waits.length === 0) return null;
  return Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10;
}

/** "about 14 min", "1 h 05 min", "2 days 3 h" */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return `${hours} h ${String(totalMinutes % 60).padStart(2, "0")} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ${hours % 24} h`;
}

/**
 * One bucket per IST day for the last `days` days (oldest first, today last), counting
 * requests created and requests fulfilled on each day.
 */
export function dailySeries(
  requests: { createdAt: Date; fulfilledAt: Date | null }[],
  now: Date,
  days = 14,
): { day: string; created: number; fulfilled: number }[] {
  const buckets = Array.from({ length: days }, (_, i) => ({
    day: istDayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)),
    created: 0,
    fulfilled: 0,
  }));
  const byDay = new Map(buckets.map((b) => [b.day, b]));
  for (const r of requests) {
    const c = byDay.get(istDayKey(r.createdAt));
    if (c) c.created += 1;
    if (r.fulfilledAt) {
      const f = byDay.get(istDayKey(r.fulfilledAt));
      if (f) f.fulfilled += 1;
    }
  }
  return buckets;
}
