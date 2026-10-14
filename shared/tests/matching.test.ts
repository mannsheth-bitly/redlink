import { describe, expect, it } from "vitest";
import { findMatches, scoreDonor, type MatchDonorInput, type MatchRequestInput } from "../src/domain/matching";

const NOW = new Date("2026-10-13T06:00:00.000Z");
const CENTER = { lat: 19.07, lng: 72.9 };
const KM_LAT = 1 / 111.195; // degrees of latitude per km

/** Donor placed `km` due north of the request. */
function donor(id: string, overrides: Partial<MatchDonorInput> & { km?: number } = {}): MatchDonorInput {
  const { km = 1, ...rest } = overrides;
  return {
    id,
    status: "ACTIVE",
    lat: CENTER.lat + km * KM_LAT,
    lng: CENTER.lng,
    bloodGroup: "O+",
    isAvailable: true,
    bloodGroupVerified: false,
    dateOfBirth: new Date("1995-01-01T00:00:00.000Z"),
    weightKg: 65,
    lastDonationAt: null,
    ...rest,
  };
}

const request = (overrides: Partial<MatchRequestInput> = {}): MatchRequestInput => ({
  bloodGroup: "O+",
  lat: CENTER.lat,
  lng: CENTER.lng,
  radiusKm: 10,
  createdById: "creator",
  alreadyMatchedDonorIds: new Set(),
  ...overrides,
});

describe("scoreDonor", () => {
  it("exact + distance 0 + verified = 100", () => {
    expect(
      scoreDonor({ donorGroup: "O+", requestGroup: "O+", distanceKm: 0, radiusKm: 10, bloodGroupVerified: true }),
    ).toBe(100);
  });

  it("compatible (not exact), at the edge, unverified = 0", () => {
    expect(
      scoreDonor({ donorGroup: "O-", requestGroup: "O+", distanceKm: 10, radiusKm: 10, bloodGroupVerified: false }),
    ).toBe(0);
  });

  it("worked example: exact match, 4 km of 10 km, unverified = 30 + 30 = 60", () => {
    expect(
      scoreDonor({ donorGroup: "B+", requestGroup: "B+", distanceKm: 4, radiusKm: 10, bloodGroupVerified: false }),
    ).toBeCloseTo(60, 10);
  });
});

describe("findMatches: filtering", () => {
  it("drops incompatible blood groups", () => {
    const res = findMatches(request(), [donor("a", { bloodGroup: "A+" }), donor("b", { bloodGroup: "O-" })], NOW);
    expect(res.map((m) => m.donorId)).toEqual(["b"]);
  });

  it("drops donors outside the radius", () => {
    const res = findMatches(request(), [donor("near", { km: 9 }), donor("far", { km: 11 })], NOW);
    expect(res.map((m) => m.donorId)).toEqual(["near"]);
  });

  it("drops ineligible donors (unavailable, cooldown, suspended)", () => {
    const res = findMatches(
      request(),
      [
        donor("ok"),
        donor("unavailable", { isAvailable: false }),
        donor("cooldown", { lastDonationAt: new Date(NOW.getTime() - 30 * 86_400_000) }),
        donor("suspended", { status: "SUSPENDED" }),
      ],
      NOW,
    );
    expect(res.map((m) => m.donorId)).toEqual(["ok"]);
  });

  it("drops the request creator, already-matched donors and donors without a location", () => {
    const res = findMatches(
      request({ alreadyMatchedDonorIds: new Set(["matched"]) }),
      [donor("creator"), donor("matched"), donor("nolocation", { lat: null, lng: null }), donor("ok")],
      NOW,
    );
    expect(res.map((m) => m.donorId)).toEqual(["ok"]);
  });
});

describe("findMatches: scoring order", () => {
  it("exact match beats a nearer universal O- donor", () => {
    const res = findMatches(request(), [donor("o-neg-near", { bloodGroup: "O-", km: 0.5 }), donor("o-pos", { km: 3 })], NOW);
    // O+ at 3 km: 30 + 35 = 65. O- at 0.5 km: 0 + 47.5 = 47.5
    expect(res.map((m) => m.donorId)).toEqual(["o-pos", "o-neg-near"]);
  });

  it("verified donor beats an unverified one at the same distance", () => {
    const res = findMatches(request(), [donor("unverified", { km: 2 }), donor("verified", { km: 2, bloodGroupVerified: true })], NOW);
    expect(res[0].donorId).toBe("verified");
  });

  it("nearer donor wins when everything else is equal", () => {
    const res = findMatches(request(), [donor("far", { km: 8 }), donor("mid", { km: 5 }), donor("near", { km: 1 })], NOW);
    expect(res.map((m) => m.donorId)).toEqual(["near", "mid", "far"]);
  });

  it("scores are sorted in descending order", () => {
    const donors = Array.from({ length: 20 }, (_, i) =>
      donor(`d${i}`, { km: (i % 9) + 0.5, bloodGroupVerified: i % 3 === 0, bloodGroup: i % 2 ? "O+" : "O-" }),
    );
    const res = findMatches(request(), donors, NOW);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
  });

  it("returns at most 50 donors", () => {
    const donors = Array.from({ length: 80 }, (_, i) => donor(`d${i}`, { km: (i % 9) + 0.1 }));
    expect(findMatches(request(), donors, NOW)).toHaveLength(50);
  });
});
