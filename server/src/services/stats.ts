import type { PublicStats } from "@red-link/shared/api";
import { isEligible } from "@red-link/shared/domain/eligibility";
import { BloodRequest, DonationRecord, User } from "../models.ts";

/** Landing-page stats (spec 8 "live stats"). No personal data. */
export async function getPublicStats(now = new Date()): Promise<PublicStats> {
  const [donors, requestsFulfilled, units] = await Promise.all([
    User.find({ role: "DONOR", status: "ACTIVE" }, { status: 1, donorProfile: 1 }).lean(),
    BloodRequest.countDocuments({ status: "FULFILLED" }),
    DonationRecord.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$units" } } }]),
  ]);
  const donorsReadyNow = donors.filter(
    (d) => d.donorProfile && isEligible({ status: d.status, ...d.donorProfile, lastDonationAt: d.donorProfile.lastDonationAt ?? null }, now).eligible,
  ).length;
  return {
    registeredDonors: donors.length,
    donorsReadyNow,
    requestsFulfilled,
    unitsDonated: units[0]?.total ?? 0,
  };
}
