import { describe, expect, it } from "vitest";
import { canDonateTo, compatibleDonorGroups, recipientGroupsFor } from "../src/domain/compatibility";
import { BLOOD_GROUPS, type BloodGroup } from "../src/domain/constants";

// Spec 5.2, written out independently so the test doesn't just re-read the implementation.
const EXPECTED: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

describe("canDonateTo: all 64 donor/recipient pairs", () => {
  const pairs = BLOOD_GROUPS.flatMap((donor) =>
    BLOOD_GROUPS.map((recipient) => ({ donor, recipient, expected: EXPECTED[recipient].includes(donor) })),
  );

  it("covers exactly 64 pairs", () => {
    expect(pairs).toHaveLength(64);
  });

  it.each(pairs)("$donor -> $recipient is $expected", ({ donor, recipient, expected }) => {
    expect(canDonateTo(donor, recipient)).toBe(expected);
  });
});

describe("compatibleDonorGroups", () => {
  it.each(BLOOD_GROUPS)("matches the spec table for %s", (recipient) => {
    expect([...compatibleDonorGroups(recipient)].sort()).toEqual([...EXPECTED[recipient]].sort());
  });

  it("O- is the universal donor", () => {
    for (const recipient of BLOOD_GROUPS) expect(canDonateTo("O-", recipient)).toBe(true);
  });

  it("AB+ is the universal recipient", () => {
    expect(compatibleDonorGroups("AB+")).toHaveLength(8);
  });
});

describe("recipientGroupsFor", () => {
  it("AB+ can only give to AB+", () => {
    expect(recipientGroupsFor("AB+")).toEqual(["AB+"]);
  });

  it("O- can give to everyone", () => {
    expect(recipientGroupsFor("O-")).toHaveLength(8);
  });
});
