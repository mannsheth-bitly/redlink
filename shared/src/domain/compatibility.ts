import type { BloodGroup } from "./constants";

/** Red-cell transfusion compatibility: recipient -> groups they can receive from (spec 5.2). */
const COMPATIBLE_DONORS: Record<BloodGroup, readonly BloodGroup[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

export function compatibleDonorGroups(recipient: BloodGroup): readonly BloodGroup[] {
  return COMPATIBLE_DONORS[recipient];
}

export function canDonateTo(donor: BloodGroup, recipient: BloodGroup): boolean {
  return COMPATIBLE_DONORS[recipient].includes(donor);
}

/** Groups a donor's blood can go to (inverse of the table above). */
export function recipientGroupsFor(donor: BloodGroup): BloodGroup[] {
  return (Object.keys(COMPATIBLE_DONORS) as BloodGroup[]).filter((recipient) =>
    canDonateTo(donor, recipient),
  );
}
