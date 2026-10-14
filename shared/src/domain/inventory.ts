import { compatibleDonorGroups } from "./compatibility";
import { BLOOD_GROUPS, type BloodGroup } from "./constants";
import { isEligible, type EligibilityInput, type EligibilityResult } from "./eligibility";

/** Spec 5 / 8: a group is low on stock when units are at or below its threshold. */
export function isLowStock(item: { units: number; lowStockThreshold: number }): boolean {
  return item.units <= item.lowStockThreshold;
}

/** New stock level after a manual adjustment; stock never goes below 0. */
export function adjustedUnits(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

/**
 * Owner decision: a bank may offer any group compatible with the request that it has in stock.
 * Exact group first (keeps universal O− for when it's really needed), then by most stock.
 */
export function offerableGroups(
  requestGroup: BloodGroup,
  stock: ReadonlyArray<{ bloodGroup: string; units: number }>,
): { bloodGroup: BloodGroup; units: number }[] {
  const compatible = new Set<string>(compatibleDonorGroups(requestGroup));
  return stock
    .filter((s) => compatible.has(s.bloodGroup) && s.units > 0)
    .map((s) => ({ bloodGroup: s.bloodGroup as BloodGroup, units: s.units }))
    .sort((a, b) => Number(b.bloodGroup === requestGroup) - Number(a.bloodGroup === requestGroup) || b.units - a.units);
}

/** Most units a bank can offer: what it has of that group, and no more than the request still needs. */
export function maxOfferUnits(stockUnits: number, unitsStillNeeded: number): number {
  return Math.max(0, Math.min(stockUnits, unitsStillNeeded));
}

/**
 * Units actually applied when an offer is accepted: never more than the request still
 * needs (other donations may have arrived since the offer was made).
 */
export function unitsToApply(offerUnits: number, unitsStillNeeded: number): number {
  return Math.max(0, Math.min(offerUnits, unitsStillNeeded));
}

/**
 * Owner decision: walk-in donations use the normal eligibility rules, except the
 * "available" toggle, because the donor is physically at the blood bank.
 */
export function walkInEligibility(donor: EligibilityInput, now: Date): EligibilityResult {
  return isEligible({ ...donor, isAvailable: true }, now);
}

/** All 8 groups in display order, filling missing rows with 0 units. */
export function fullInventory<T extends { bloodGroup: string; units: number; lowStockThreshold: number }>(
  rows: readonly T[],
  defaultThreshold: number,
): { bloodGroup: BloodGroup; units: number; lowStockThreshold: number }[] {
  return BLOOD_GROUPS.map((g) => {
    const row = rows.find((r) => r.bloodGroup === g);
    return { bloodGroup: g, units: row?.units ?? 0, lowStockThreshold: row?.lowStockThreshold ?? defaultThreshold };
  });
}
