import { describe, expect, it } from "vitest";
import { ageInYears, isEligible, nextEligibleDate, type EligibilityInput } from "../src/domain/eligibility";

const NOW = new Date("2026-10-13T06:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const base: EligibilityInput = {
  status: "ACTIVE",
  isAvailable: true,
  dateOfBirth: new Date("1998-05-20T00:00:00.000Z"),
  weightKg: 70,
  lastDonationAt: null,
};

describe("isEligible", () => {
  it("eligible donor who has never donated", () => {
    const result = isEligible(base, NOW);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.nextEligibleDate).toBeNull();
  });

  describe("90-day cooldown boundaries", () => {
    it("89 days after donating: not eligible", () => {
      const result = isEligible({ ...base, lastDonationAt: daysAgo(89) }, NOW);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/You can donate again on/);
    });

    it("exactly 90 days after donating: eligible", () => {
      expect(isEligible({ ...base, lastDonationAt: daysAgo(90) }, NOW).eligible).toBe(true);
    });

    it("one millisecond before 90 days: not eligible", () => {
      const last = new Date(NOW.getTime() - 90 * DAY + 1);
      expect(isEligible({ ...base, lastDonationAt: last }, NOW).eligible).toBe(false);
    });

    it("91 days after donating: eligible", () => {
      expect(isEligible({ ...base, lastDonationAt: daysAgo(91) }, NOW).eligible).toBe(true);
    });

    it("nextEligibleDate is lastDonationAt + 90 days", () => {
      const last = daysAgo(10);
      expect(nextEligibleDate(last)?.getTime()).toBe(last.getTime() + 90 * DAY);
      expect(isEligible({ ...base, lastDonationAt: last }, NOW).nextEligibleDate?.getTime()).toBe(
        last.getTime() + 90 * DAY,
      );
    });
  });

  describe("age 18–65", () => {
    it("17 (turns 18 tomorrow): not eligible", () => {
      const dob = new Date("2008-10-14T00:00:00.000Z");
      expect(ageInYears(dob, NOW)).toBe(17);
      expect(isEligible({ ...base, dateOfBirth: dob }, NOW).eligible).toBe(false);
    });

    it("18th birthday today: eligible", () => {
      const dob = new Date("2008-10-13T00:00:00.000Z");
      expect(ageInYears(dob, NOW)).toBe(18);
      expect(isEligible({ ...base, dateOfBirth: dob }, NOW).eligible).toBe(true);
    });

    it("65 (day before 66th birthday): eligible", () => {
      const dob = new Date("1960-10-14T00:00:00.000Z");
      expect(ageInYears(dob, NOW)).toBe(65);
      expect(isEligible({ ...base, dateOfBirth: dob }, NOW).eligible).toBe(true);
    });

    it("66th birthday today: not eligible", () => {
      const dob = new Date("1960-10-13T00:00:00.000Z");
      expect(ageInYears(dob, NOW)).toBe(66);
      expect(isEligible({ ...base, dateOfBirth: dob }, NOW).eligible).toBe(false);
    });
  });

  describe("weight ≥ 50 kg", () => {
    it("49.9 kg: not eligible", () => {
      expect(isEligible({ ...base, weightKg: 49.9 }, NOW).eligible).toBe(false);
    });
    it("50 kg: eligible", () => {
      expect(isEligible({ ...base, weightKg: 50 }, NOW).eligible).toBe(true);
    });
  });

  it("unavailable donor is not eligible", () => {
    expect(isEligible({ ...base, isAvailable: false }, NOW).eligible).toBe(false);
  });

  it.each(["PENDING_VERIFICATION", "SUSPENDED", "REJECTED"])("status %s is not eligible", (status) => {
    expect(isEligible({ ...base, status }, NOW).eligible).toBe(false);
  });

  it("lists every failing rule", () => {
    const result = isEligible({ ...base, isAvailable: false, weightKg: 45, lastDonationAt: daysAgo(5) }, NOW);
    expect(result.reasons).toHaveLength(3);
  });
});
