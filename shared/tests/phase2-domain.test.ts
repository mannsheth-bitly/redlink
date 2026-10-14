import { describe, expect, it } from "vitest";
import { maskName } from "../src/domain/privacy";
import {
  maxUnitsForDonation,
  nextMatchStatus,
  requestPathFor,
  sortFeed,
  sortMatchesForInstitution,
  unitsRemaining,
} from "../src/domain/requests";

describe("maskName", () => {
  it.each([
    ["Rahul Sharma", "Rahul S."],
    ["Ananya Iyer", "Ananya I."],
    ["  Sai  Kiran   Reddy ", "Sai R."],
    ["Madhu", "Madhu"],
    ["", "Donor"],
    ["rahul sharma", "rahul S."],
  ])("%j -> %j", (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });
});

describe("nextMatchStatus", () => {
  it("NOTIFIED can accept or decline", () => {
    expect(nextMatchStatus("NOTIFIED", "ACCEPT", "OPEN")).toEqual({ status: "ACCEPTED" });
    expect(nextMatchStatus("NOTIFIED", "DECLINE", "OPEN")).toEqual({ status: "DECLINED" });
  });

  it("ACCEPTED can withdraw (decline) until the donation is recorded", () => {
    expect(nextMatchStatus("ACCEPTED", "DECLINE", "PARTIALLY_FULFILLED")).toEqual({ status: "DECLINED" });
  });

  it("DECLINED can change back to accepted", () => {
    expect(nextMatchStatus("DECLINED", "ACCEPT", "OPEN")).toEqual({ status: "ACCEPTED" });
  });

  it("repeating the same response is an error", () => {
    expect(nextMatchStatus("ACCEPTED", "ACCEPT", "OPEN")).toHaveProperty("error");
    expect(nextMatchStatus("DECLINED", "DECLINE", "OPEN")).toHaveProperty("error");
  });

  it("DONATED and NO_LONGER_NEEDED are final", () => {
    expect(nextMatchStatus("DONATED", "DECLINE", "OPEN")).toHaveProperty("error");
    expect(nextMatchStatus("NO_LONGER_NEEDED", "ACCEPT", "OPEN")).toHaveProperty("error");
  });

  it.each(["FULFILLED", "CANCELLED", "EXPIRED"])("no responses once the request is %s", (status) => {
    expect(nextMatchStatus("NOTIFIED", "ACCEPT", status)).toHaveProperty("error");
    expect(nextMatchStatus("ACCEPTED", "DECLINE", status)).toHaveProperty("error");
  });
});

describe("units", () => {
  it("unitsRemaining never goes below 0", () => {
    expect(unitsRemaining({ unitsNeeded: 3, unitsFulfilled: 1 })).toBe(2);
    expect(unitsRemaining({ unitsNeeded: 2, unitsFulfilled: 3 })).toBe(0);
  });

  it("maxUnitsForDonation is 2, capped by what is still needed", () => {
    expect(maxUnitsForDonation({ unitsNeeded: 5, unitsFulfilled: 0 })).toBe(2);
    expect(maxUnitsForDonation({ unitsNeeded: 5, unitsFulfilled: 4 })).toBe(1);
    expect(maxUnitsForDonation({ unitsNeeded: 2, unitsFulfilled: 2 })).toBe(0);
  });
});

describe("sortFeed", () => {
  it("sorts by urgency (critical first), then distance", () => {
    const items = [
      { id: "normal-near", urgency: "NORMAL", distanceKm: 1 },
      { id: "urgent-far", urgency: "URGENT", distanceKm: 20 },
      { id: "critical-far", urgency: "CRITICAL", distanceKm: 40 },
      { id: "urgent-near", urgency: "URGENT", distanceKm: 2 },
    ];
    expect(sortFeed(items).map((i) => i.id)).toEqual(["critical-far", "urgent-near", "urgent-far", "normal-near"]);
  });

  it("does not mutate the input", () => {
    const items = [
      { urgency: "NORMAL", distanceKm: 1 },
      { urgency: "CRITICAL", distanceKm: 1 },
    ];
    sortFeed(items);
    expect(items[0].urgency).toBe("NORMAL");
  });
});

describe("sortMatchesForInstitution", () => {
  it("orders donated, accepted, notified, declined; then by score", () => {
    const m = [
      { id: "declined", status: "DECLINED", score: 99, distanceKm: 1 },
      { id: "notified-low", status: "NOTIFIED", score: 10, distanceKm: 1 },
      { id: "accepted", status: "ACCEPTED", score: 20, distanceKm: 5 },
      { id: "notified-high", status: "NOTIFIED", score: 80, distanceKm: 3 },
      { id: "donated", status: "DONATED", score: 5, distanceKm: 9 },
    ];
    expect(sortMatchesForInstitution(m).map((x) => x.id)).toEqual([
      "donated",
      "accepted",
      "notified-high",
      "notified-low",
      "declined",
    ]);
  });
});

describe("requestPathFor", () => {
  it("routes each requester role to its own area", () => {
    expect(requestPathFor("HOSPITAL", "abc")).toBe("/hospital/requests/abc");
    expect(requestPathFor("EMERGENCY", "abc")).toBe("/emergency/requests/abc");
    expect(requestPathFor("RECEIVER", "abc")).toBe("/receiver/requests/abc");
  });
});
