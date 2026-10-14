import { describe, expect, it } from "vitest";
import {
  averageFirstAcceptanceMinutes,
  dailySeries,
  formatDuration,
  fulfilmentRate,
  istDayKey,
  startOfIstDay,
  startOfIstMonth,
} from "../src/domain/analytics";
import { flagOutcome, flagOutcomeMessage, userStatusChange, verificationOutcome } from "../src/domain/moderation";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("IST calendar helpers", () => {
  it("uses the IST date, not the UTC date", () => {
    // 20:00 UTC on 13 Oct is 01:30 IST on 14 Oct.
    expect(istDayKey(new Date("2026-10-13T20:00:00.000Z"))).toBe("2026-10-14");
    expect(istDayKey(new Date("2026-10-13T18:29:59.000Z"))).toBe("2026-10-13");
  });

  it("finds the start of the IST month", () => {
    expect(startOfIstMonth(new Date("2026-10-14T06:00:00.000Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
    // 30 Sep 19:00 UTC is already 1 Oct in India.
    expect(startOfIstMonth(new Date("2026-09-30T19:00:00.000Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("finds the start of an IST day", () => {
    const now = new Date("2026-10-14T06:00:00.000Z");
    expect(startOfIstDay(now).toISOString()).toBe("2026-10-13T18:30:00.000Z");
    expect(startOfIstDay(now, 13).toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });
});

describe("fulfilmentRate", () => {
  it("is fulfilled ÷ closed requests", () => {
    expect(fulfilmentRate({ fulfilled: 6, cancelled: 1, expired: 1 })).toBe(75);
    expect(fulfilmentRate({ fulfilled: 1, cancelled: 2, expired: 0 })).toBe(33.3);
  });
  it("is null when nothing has closed yet", () => {
    expect(fulfilmentRate({ fulfilled: 0, cancelled: 0, expired: 0 })).toBeNull();
  });
});

describe("averageFirstAcceptanceMinutes", () => {
  const t0 = new Date("2026-10-01T00:00:00.000Z");
  it("averages the first acceptance of each request", () => {
    expect(
      averageFirstAcceptanceMinutes([
        { createdAt: t0, firstAcceptedAt: new Date(t0.getTime() + 6 * MIN) },
        { createdAt: t0, firstAcceptedAt: new Date(t0.getTime() + 14 * MIN) },
      ]),
    ).toBe(10);
  });
  it("leaves out requests nobody accepted", () => {
    expect(
      averageFirstAcceptanceMinutes([
        { createdAt: t0, firstAcceptedAt: new Date(t0.getTime() + 3 * MIN) },
        { createdAt: t0, firstAcceptedAt: null },
      ]),
    ).toBe(3);
    expect(averageFirstAcceptanceMinutes([{ createdAt: t0, firstAcceptedAt: null }])).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats minutes, hours and days", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.4)).toBe("under 1 min");
    expect(formatDuration(18.4)).toBe("18 min");
    expect(formatDuration(65)).toBe("1 h 05 min");
    expect(formatDuration(3 * 24 * 60 + 120)).toBe("3 days 2 h");
  });
});

describe("dailySeries", () => {
  const now = new Date("2026-10-14T06:00:00.000Z");
  it("has one bucket per day, oldest first, today last", () => {
    const s = dailySeries([], now);
    expect(s).toHaveLength(14);
    expect(s[0].day).toBe("2026-10-01");
    expect(s[13].day).toBe("2026-10-14");
  });
  it("counts created and fulfilled on their own IST days and ignores older ones", () => {
    const s = dailySeries(
      [
        { createdAt: new Date(now.getTime() - 2 * DAY), fulfilledAt: new Date(now.getTime() - 2 * DAY + 5 * HOUR) },
        { createdAt: new Date(now.getTime() - HOUR), fulfilledAt: null },
        { createdAt: new Date(now.getTime() - 30 * DAY), fulfilledAt: new Date(now.getTime() - 1 * DAY) },
      ],
      now,
    );
    expect(s.reduce((a, b) => a + b.created, 0)).toBe(2);
    expect(s.find((b) => b.day === "2026-10-12")).toMatchObject({ created: 1, fulfilled: 1 });
    expect(s.find((b) => b.day === "2026-10-13")).toMatchObject({ created: 0, fulfilled: 1 });
    expect(s[13]).toMatchObject({ created: 1, fulfilled: 0 });
  });
});

describe("verificationOutcome", () => {
  const pending = { role: "HOSPITAL", status: "PENDING_VERIFICATION" };
  it("approves to ACTIVE and rejects to REJECTED", () => {
    expect(verificationOutcome(pending, "APPROVE", null)).toEqual({ status: "ACTIVE" });
    expect(verificationOutcome(pending, "REJECT", "Licence number not found")).toEqual({ status: "REJECTED" });
  });
  it("needs a note to reject", () => {
    expect(verificationOutcome(pending, "REJECT", null)).toHaveProperty("error");
  });
  it("only works on pending accounts", () => {
    expect(verificationOutcome({ role: "HOSPITAL", status: "ACTIVE" }, "APPROVE", null)).toHaveProperty("error");
    expect(verificationOutcome({ role: "HOSPITAL", status: "REJECTED" }, "APPROVE", null)).toHaveProperty("error");
  });
});

describe("userStatusChange", () => {
  const donor = { id: "u1", role: "DONOR", status: "ACTIVE" };
  it("suspends active accounts and reactivates suspended ones", () => {
    expect(userStatusChange(donor, "admin", "SUSPEND")).toEqual({ from: "ACTIVE", to: "SUSPENDED" });
    expect(userStatusChange({ ...donor, status: "SUSPENDED" }, "admin", "REACTIVATE")).toEqual({ from: "SUSPENDED", to: "ACTIVE" });
  });
  it("refuses admins, yourself, and the wrong starting status", () => {
    expect(userStatusChange({ ...donor, role: "ADMIN" }, "admin", "SUSPEND")).toHaveProperty("error");
    expect(userStatusChange(donor, "u1", "SUSPEND")).toHaveProperty("error");
    expect(userStatusChange({ ...donor, status: "SUSPENDED" }, "admin", "SUSPEND")).toHaveProperty("error");
    expect(userStatusChange({ ...donor, status: "PENDING_VERIFICATION" }, "admin", "SUSPEND")).toHaveProperty("error");
    expect(userStatusChange(donor, "admin", "REACTIVATE")).toHaveProperty("error");
  });
});

describe("flagOutcome", () => {
  const open = { status: "OPEN", hasTarget: true };
  it("maps each action to a final status", () => {
    expect(flagOutcome(open, "RESOLVE")).toEqual({ status: "RESOLVED", suspendTarget: false });
    expect(flagOutcome(open, "DISMISS")).toEqual({ status: "DISMISSED", suspendTarget: false });
    expect(flagOutcome(open, "SUSPEND_AND_RESOLVE")).toEqual({ status: "RESOLVED", suspendTarget: true });
  });
  it("refuses flags already reviewed, and suspending without a target", () => {
    expect(flagOutcome({ status: "RESOLVED", hasTarget: true }, "DISMISS")).toHaveProperty("error");
    expect(flagOutcome({ status: "OPEN", hasTarget: false }, "SUSPEND_AND_RESOLVE")).toHaveProperty("error");
  });
  it("tells the reporter the outcome, with the note if given", () => {
    expect(flagOutcomeMessage("DISMISS", null).body).toContain("no action was needed");
    expect(flagOutcomeMessage("SUSPEND_AND_RESOLVE", "Repeated no-shows").body).toContain('"Repeated no-shows"');
  });
});
