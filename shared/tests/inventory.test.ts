import { describe, expect, it } from "vitest";
import {
  adjustedUnits,
  fullInventory,
  isLowStock,
  maxOfferUnits,
  offerableGroups,
  unitsToApply,
  walkInEligibility,
} from "../src/domain/inventory";

const NOW = new Date("2026-10-13T06:00:00.000Z");
const DAY = 86_400_000;

describe("isLowStock", () => {
  it("is low at or below the threshold", () => {
    expect(isLowStock({ units: 2, lowStockThreshold: 5 })).toBe(true);
    expect(isLowStock({ units: 5, lowStockThreshold: 5 })).toBe(true);
    expect(isLowStock({ units: 6, lowStockThreshold: 5 })).toBe(false);
    expect(isLowStock({ units: 0, lowStockThreshold: 0 })).toBe(true);
  });
});

describe("adjustedUnits", () => {
  it("adds and removes, never below 0", () => {
    expect(adjustedUnits(5, 3)).toBe(8);
    expect(adjustedUnits(5, -2)).toBe(3);
    expect(adjustedUnits(1, -5)).toBe(0);
  });
});

describe("offerableGroups", () => {
  const stock = [
    { bloodGroup: "O-", units: 2 },
    { bloodGroup: "O+", units: 24 },
    { bloodGroup: "A-", units: 0 },
    { bloodGroup: "A+", units: 18 },
    { bloodGroup: "B+", units: 21 },
    { bloodGroup: "AB+", units: 11 },
  ];

  it("only compatible groups with stock, exact group first", () => {
    expect(offerableGroups("A+", stock).map((s) => s.bloodGroup)).toEqual(["A+", "O+", "O-"]);
  });

  it("O- patients can only get O-", () => {
    expect(offerableGroups("O-", stock).map((s) => s.bloodGroup)).toEqual(["O-"]);
  });

  it("nothing to offer when compatible stock is empty", () => {
    expect(offerableGroups("A-", [{ bloodGroup: "A-", units: 0 }, { bloodGroup: "B+", units: 9 }])).toEqual([]);
  });

  it("AB+ can take every group in stock", () => {
    expect(offerableGroups("AB+", stock)).toHaveLength(5);
  });
});

describe("offer units", () => {
  it("maxOfferUnits is capped by stock and need", () => {
    expect(maxOfferUnits(24, 2)).toBe(2);
    expect(maxOfferUnits(1, 3)).toBe(1);
    expect(maxOfferUnits(0, 3)).toBe(0);
  });

  it("unitsToApply never overshoots the remaining need", () => {
    expect(unitsToApply(3, 3)).toBe(3);
    expect(unitsToApply(3, 1)).toBe(1);
    expect(unitsToApply(2, 0)).toBe(0);
  });
});

describe("walkInEligibility", () => {
  const donor = {
    status: "ACTIVE",
    isAvailable: false, // toggle off, but they're physically present
    dateOfBirth: new Date("1995-01-01T00:00:00.000Z"),
    weightKg: 60,
    lastDonationAt: null as Date | null,
  };

  it("ignores the availability toggle", () => {
    expect(walkInEligibility(donor, NOW).eligible).toBe(true);
  });

  it("still enforces the 90-day rest", () => {
    const r = walkInEligibility({ ...donor, lastDonationAt: new Date(NOW.getTime() - 30 * DAY) }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/donate again on/);
  });

  it("still enforces weight and status", () => {
    expect(walkInEligibility({ ...donor, weightKg: 45 }, NOW).eligible).toBe(false);
    expect(walkInEligibility({ ...donor, status: "SUSPENDED" }, NOW).eligible).toBe(false);
  });
});

describe("fullInventory", () => {
  it("returns all 8 groups in order, filling gaps with 0", () => {
    const inv = fullInventory([{ bloodGroup: "B+", units: 4, lowStockThreshold: 3 }], 5);
    expect(inv.map((i) => i.bloodGroup)).toEqual(["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]);
    expect(inv.find((i) => i.bloodGroup === "B+")).toEqual({ bloodGroup: "B+", units: 4, lowStockThreshold: 3 });
    expect(inv.find((i) => i.bloodGroup === "O-")).toEqual({ bloodGroup: "O-", units: 0, lowStockThreshold: 5 });
  });
});
