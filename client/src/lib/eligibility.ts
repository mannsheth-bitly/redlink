import type { ApiUser } from "@red-link/shared/api";
import { isEligible } from "@red-link/shared/domain/eligibility";

/** The donor's eligibility, using the same shared rule as the server (spec 5.3). */
export function donorEligibility(user: ApiUser, now = new Date()) {
  const p = user.donorProfile;
  if (!p) return null;
  const result = isEligible(
    {
      status: user.status,
      isAvailable: p.isAvailable,
      dateOfBirth: new Date(p.dateOfBirth),
      weightKg: p.weightKg,
      lastDonationAt: p.lastDonationAt ? new Date(p.lastDonationAt) : null,
    },
    now,
  );
  return {
    eligible: result.eligible,
    reason: result.reason,
    reasons: result.reasons,
    nextEligibleDate: result.nextEligibleDate?.toISOString() ?? null,
    inCooldown: result.nextEligibleDate !== null && result.nextEligibleDate.getTime() > now.getTime(),
  };
}
