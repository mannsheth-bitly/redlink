import { describe, expect, it } from "vitest";
import {
  allowedUrgencies,
  canExpandManually,
  canTransition,
  expandedRadiusKm,
  initialRadiusKm,
  isExpired,
  shouldAutoEscalate,
  statusForUnits,
} from "../src/domain/requests";
import { REQUEST_STATUSES } from "../src/domain/constants";

const NOW = new Date("2026-10-13T06:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("radius by urgency", () => {
  it("initial radii are 10 / 25 / 50 km", () => {
    expect(initialRadiusKm("NORMAL")).toBe(10);
    expect(initialRadiusKm("URGENT")).toBe(25);
    expect(initialRadiusKm("CRITICAL")).toBe(50);
  });

  it("URGENT expands +25 km up to 75 km", () => {
    expect(expandedRadiusKm(25)).toBe(50);
    expect(expandedRadiusKm(50)).toBe(75);
    expect(expandedRadiusKm(75)).toBe(75);
  });

  it("only active URGENT requests below 75 km can be expanded manually", () => {
    expect(canExpandManually({ urgency: "URGENT", radiusKm: 25, status: "OPEN" })).toBe(true);
    expect(canExpandManually({ urgency: "URGENT", radiusKm: 75, status: "OPEN" })).toBe(false);
    expect(canExpandManually({ urgency: "NORMAL", radiusKm: 10, status: "OPEN" })).toBe(false);
    expect(canExpandManually({ urgency: "CRITICAL", radiusKm: 50, status: "OPEN" })).toBe(false);
    expect(canExpandManually({ urgency: "URGENT", radiusKm: 25, status: "FULFILLED" })).toBe(false);
  });
});

describe("shouldAutoEscalate (CRITICAL)", () => {
  const critical = { urgency: "CRITICAL", status: "OPEN", radiusKm: 50, createdAt: minutesAgo(10), lastEscalatedAt: null };

  it("escalates after 10 minutes with fewer than 3 accepted", () => {
    expect(shouldAutoEscalate(critical, 2, NOW)).toBe(true);
  });

  it("does not escalate before 10 minutes", () => {
    expect(shouldAutoEscalate({ ...critical, createdAt: minutesAgo(9) }, 0, NOW)).toBe(false);
  });

  it("does not escalate with 3 or more accepted", () => {
    expect(shouldAutoEscalate(critical, 3, NOW)).toBe(false);
  });

  it("escalates only once", () => {
    expect(shouldAutoEscalate({ ...critical, lastEscalatedAt: minutesAgo(1) }, 0, NOW)).toBe(false);
  });

  it("does not escalate non-CRITICAL or closed requests", () => {
    expect(shouldAutoEscalate({ ...critical, urgency: "URGENT" }, 0, NOW)).toBe(false);
    expect(shouldAutoEscalate({ ...critical, status: "CANCELLED" }, 0, NOW)).toBe(false);
  });
});

describe("lifecycle", () => {
  it("statusForUnits", () => {
    expect(statusForUnits(0, 3)).toBe("OPEN");
    expect(statusForUnits(1, 3)).toBe("PARTIALLY_FULFILLED");
    expect(statusForUnits(3, 3)).toBe("FULFILLED");
    expect(statusForUnits(4, 3)).toBe("FULFILLED");
  });

  it("isExpired only for active requests past neededBy", () => {
    expect(isExpired({ status: "OPEN", neededBy: minutesAgo(1) }, NOW)).toBe(true);
    expect(isExpired({ status: "PARTIALLY_FULFILLED", neededBy: minutesAgo(1) }, NOW)).toBe(true);
    expect(isExpired({ status: "OPEN", neededBy: new Date(NOW.getTime() + 60_000) }, NOW)).toBe(false);
    expect(isExpired({ status: "FULFILLED", neededBy: minutesAgo(1) }, NOW)).toBe(false);
  });

  it("allowed transitions", () => {
    expect(canTransition("OPEN", "PARTIALLY_FULFILLED")).toBe(true);
    expect(canTransition("OPEN", "FULFILLED")).toBe(true);
    expect(canTransition("PARTIALLY_FULFILLED", "FULFILLED")).toBe(true);
    expect(canTransition("OPEN", "CANCELLED")).toBe(true);
    expect(canTransition("PARTIALLY_FULFILLED", "EXPIRED")).toBe(true);
  });

  it("terminal states cannot change", () => {
    for (const from of ["FULFILLED", "CANCELLED", "EXPIRED"] as const) {
      for (const to of REQUEST_STATUSES) expect(canTransition(from, to)).toBe(false);
    }
  });

  it("cannot go backwards", () => {
    expect(canTransition("PARTIALLY_FULFILLED", "OPEN")).toBe(false);
  });
});

describe("allowedUrgencies", () => {
  it("only EMERGENCY may create CRITICAL", () => {
    expect(allowedUrgencies("EMERGENCY")).toContain("CRITICAL");
    expect(allowedUrgencies("HOSPITAL")).not.toContain("CRITICAL");
    expect(allowedUrgencies("RECEIVER")).not.toContain("CRITICAL");
    expect(allowedUrgencies("DONOR")).toEqual([]);
  });
});
