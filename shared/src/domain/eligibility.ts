import {
  DONATION_COOLDOWN_DAYS,
  MAX_DONOR_AGE,
  MIN_DONOR_AGE,
  MIN_DONOR_WEIGHT_KG,
} from "./constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface EligibilityInput {
  status: string;
  isAvailable: boolean;
  dateOfBirth: Date;
  weightKg: number;
  lastDonationAt: Date | null;
}

export interface EligibilityResult {
  eligible: boolean;
  /** First failing rule, for a one-line UI message; null when eligible. */
  reason: string | null;
  /** Every failing rule. */
  reasons: string[];
  /** When the 90-day cooldown ends; null if the donor has never donated. */
  nextEligibleDate: Date | null;
}

/** Whole years between `dateOfBirth` and `now` (birthday not yet reached this year = one less). */
export function ageInYears(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function nextEligibleDate(lastDonationAt: Date | null): Date | null {
  if (!lastDonationAt) return null;
  return new Date(lastDonationAt.getTime() + DONATION_COOLDOWN_DAYS * MS_PER_DAY);
}

/** Spec 5.3: a donor is eligible only if every rule passes. */
export function isEligible(donor: EligibilityInput, now: Date): EligibilityResult {
  const reasons: string[] = [];

  if (donor.status !== "ACTIVE") reasons.push("Account is not active.");
  if (!donor.isAvailable) reasons.push("You have marked yourself as unavailable.");

  const age = ageInYears(donor.dateOfBirth, now);
  if (age < MIN_DONOR_AGE) reasons.push(`Donors must be at least ${MIN_DONOR_AGE} years old.`);
  if (age > MAX_DONOR_AGE) reasons.push(`Donors must be ${MAX_DONOR_AGE} years old or younger.`);

  if (donor.weightKg < MIN_DONOR_WEIGHT_KG) {
    reasons.push(`Donors must weigh at least ${MIN_DONOR_WEIGHT_KG} kg.`);
  }

  const nextDate = nextEligibleDate(donor.lastDonationAt);
  if (nextDate && now.getTime() < nextDate.getTime()) {
    reasons.push(`You can donate again on ${formatDate(nextDate)}.`);
  }

  return {
    eligible: reasons.length === 0,
    reason: reasons[0] ?? null,
    reasons,
    nextEligibleDate: nextDate,
  };
}

/** e.g. "12 Jan 2027" */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
