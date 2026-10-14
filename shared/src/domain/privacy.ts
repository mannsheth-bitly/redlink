/** Map grid size in degrees: 0.01° ≈ 1.1 km north–south (owner decision for the receiver map). */
export const MAP_GRID_DEG = 0.01;

/**
 * Snaps a location to the centre of its ~1 km grid square so a map pin never shows a
 * donor's exact position (spec 5.6). Everyone in the same square gets the same point.
 */
export function snapToGrid(p: { lat: number; lng: number }): { lat: number; lng: number } {
  const snap = (v: number) => Number(((Math.floor(v / MAP_GRID_DEG) + 0.5) * MAP_GRID_DEG).toFixed(3));
  return { lat: snap(p.lat), lng: snap(p.lng) };
}

/** Contact request transitions (spec 7.B): only a PENDING request can be answered. */
export function nextContactStatus(
  current: string,
  action: "ACCEPT" | "DECLINE",
): { status: "ACCEPTED" | "DECLINED" } | { error: string } {
  if (current !== "PENDING") return { error: "You've already responded to this contact request." };
  return { status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" };
}

/** A receiver can't send a new request to a donor while one is pending or already accepted. */
export function canSendContactRequest(existingStatuses: readonly string[]): { ok: true } | { error: string } {
  if (existingStatuses.includes("ACCEPTED")) return { error: "This donor has already shared their number with you." };
  if (existingStatuses.includes("PENDING")) return { error: "You already have a pending request to this donor." };
  return { ok: true };
}

/** "Rahul Sharma" -> "Rahul S." (spec decision #3: masked by default). */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Donor";
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
