import {
  CRITICAL_ESCALATED_RADIUS_KM,
  CRITICAL_ESCALATION_AFTER_MINUTES,
  CRITICAL_ESCALATION_MIN_ACCEPTED,
  INITIAL_RADIUS_KM,
  MAX_UNITS_PER_DONATION,
  URGENT_EXPAND_STEP_KM,
  URGENT_MAX_RADIUS_KM,
  type MatchStatus,
  type RequestStatus,
  type Role,
  type Urgency,
} from "./constants";

/** Statuses in which a request still needs blood. */
export const ACTIVE_REQUEST_STATUSES: readonly RequestStatus[] = ["OPEN", "PARTIALLY_FULFILLED"];

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(status);
}

/** Spec 4: who may create which urgency. */
export function allowedUrgencies(role: Role): Urgency[] {
  switch (role) {
    case "EMERGENCY":
      return ["NORMAL", "URGENT", "CRITICAL"];
    case "HOSPITAL":
    case "RECEIVER":
      return ["NORMAL", "URGENT"];
    default:
      return [];
  }
}

export function initialRadiusKm(urgency: Urgency): number {
  return INITIAL_RADIUS_KM[urgency];
}

/** Spec 5.4: only URGENT requests have a manual "Expand radius" (+25 km, max 75 km). */
export function canExpandManually(request: { urgency: string; radiusKm: number; status: string }): boolean {
  return (
    request.urgency === "URGENT" && isActiveStatus(request.status) && request.radiusKm < URGENT_MAX_RADIUS_KM
  );
}

export function expandedRadiusKm(currentRadiusKm: number): number {
  return Math.min(currentRadiusKm + URGENT_EXPAND_STEP_KM, URGENT_MAX_RADIUS_KM);
}

/**
 * Spec 5.4: a CRITICAL request with fewer than 3 accepted donors after 10 minutes
 * expands once to 100 km.
 */
export function shouldAutoEscalate(
  request: {
    urgency: string;
    status: string;
    radiusKm: number;
    createdAt: Date;
    lastEscalatedAt: Date | null;
  },
  acceptedCount: number,
  now: Date,
): boolean {
  if (request.urgency !== "CRITICAL") return false;
  if (!isActiveStatus(request.status)) return false;
  if (request.lastEscalatedAt !== null) return false;
  if (request.radiusKm >= CRITICAL_ESCALATED_RADIUS_KM) return false;
  if (acceptedCount >= CRITICAL_ESCALATION_MIN_ACCEPTED) return false;
  const dueAt = request.createdAt.getTime() + CRITICAL_ESCALATION_AFTER_MINUTES * 60 * 1000;
  return now.getTime() >= dueAt;
}

/** Spec 5.7: an active request whose `neededBy` has passed is EXPIRED. */
export function isExpired(request: { status: string; neededBy: Date }, now: Date): boolean {
  return isActiveStatus(request.status) && request.neededBy.getTime() < now.getTime();
}

/** Spec 5.7: status after `unitsFulfilled` changes. */
export function statusForUnits(unitsFulfilled: number, unitsNeeded: number): RequestStatus {
  if (unitsFulfilled >= unitsNeeded) return "FULFILLED";
  if (unitsFulfilled > 0) return "PARTIALLY_FULFILLED";
  return "OPEN";
}

const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  OPEN: ["PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED", "EXPIRED"],
  PARTIALLY_FULFILLED: ["FULFILLED", "CANCELLED", "EXPIRED"],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/** Spec 5.7: OPEN → PARTIALLY_FULFILLED → FULFILLED, or CANCELLED, or EXPIRED. */
export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Donor responses
// ---------------------------------------------------------------------------

export type MatchAction = "ACCEPT" | "DECLINE";

/**
 * New match status after a donor responds, or an error message.
 * Donors may change their mind (ACCEPTED -> DECLINED and back) until the donation
 * is recorded or the request closes (owner decision).
 */
export function nextMatchStatus(
  current: string,
  action: MatchAction,
  requestStatus: string,
): { status: MatchStatus } | { error: string } {
  if (!isActiveStatus(requestStatus)) return { error: "This request is no longer open." };
  if (current === "DONATED") return { error: "Your donation for this request has already been recorded." };
  if (current === "NO_LONGER_NEEDED") return { error: "This request no longer needs donors." };
  if (action === "ACCEPT") {
    if (current === "ACCEPTED") return { error: "You have already accepted this request." };
    return { status: "ACCEPTED" };
  }
  if (current === "DECLINED") return { error: "You have already declined this request." };
  return { status: "DECLINED" };
}

// ---------------------------------------------------------------------------
// Recording donations
// ---------------------------------------------------------------------------

export function unitsRemaining(request: { unitsNeeded: number; unitsFulfilled: number }): number {
  return Math.max(0, request.unitsNeeded - request.unitsFulfilled);
}

/** Staff may record 1–2 units per donor, never more than the request still needs. */
export function maxUnitsForDonation(request: { unitsNeeded: number; unitsFulfilled: number }): number {
  return Math.min(MAX_UNITS_PER_DONATION, unitsRemaining(request));
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

const URGENCY_RANK: Record<string, number> = { CRITICAL: 0, URGENT: 1, NORMAL: 2 };

/** Spec 8: donor feed sorted by urgency (critical first), then distance. */
export function sortFeed<T extends { urgency: string; distanceKm: number }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9) || a.distanceKm - b.distanceKm,
  );
}

const MATCH_GROUP_ORDER: Record<string, number> = {
  DONATED: 0,
  ACCEPTED: 1,
  NOTIFIED: 2,
  DECLINED: 3,
  NO_LONGER_NEEDED: 4,
};

/**
 * Spec 7.A step 4: institution's ranked list — accepted donors, then notified, then declined.
 * Donors who already donated are shown first; within each group, highest score first.
 */
export function sortMatchesForInstitution<T extends { status: string; score: number; distanceKm: number }>(
  matches: readonly T[],
): T[] {
  return [...matches].sort(
    (a, b) =>
      (MATCH_GROUP_ORDER[a.status] ?? 9) - (MATCH_GROUP_ORDER[b.status] ?? 9) ||
      b.score - a.score ||
      a.distanceKm - b.distanceKm,
  );
}

/** Where each role views its own request. */
export function requestPathFor(role: string, requestId: string): string {
  switch (role) {
    case "HOSPITAL":
      return `/hospital/requests/${requestId}`;
    case "EMERGENCY":
      return `/emergency/requests/${requestId}`;
    case "RECEIVER":
      return `/receiver/requests/${requestId}`;
    default:
      return "/";
  }
}
