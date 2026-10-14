import { canDonateTo } from "./compatibility";
import {
  MAX_DONORS_NOTIFIED_PER_STEP,
  SCORE_EXACT_GROUP,
  SCORE_PROXIMITY_MAX,
  SCORE_VERIFIED,
  type BloodGroup,
} from "./constants";
import { isEligible } from "./eligibility";
import { haversineKm, type LatLng } from "./geo";

export interface MatchRequestInput {
  bloodGroup: BloodGroup;
  lat: number;
  lng: number;
  radiusKm: number;
  createdById: string;
  /** Donors already holding a RequestMatch row for this request. */
  alreadyMatchedDonorIds: ReadonlySet<string>;
}

export interface MatchDonorInput {
  id: string;
  status: string;
  lat: number | null;
  lng: number | null;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  bloodGroupVerified: boolean;
  dateOfBirth: Date;
  weightKg: number;
  lastDonationAt: Date | null;
}

export interface MatchResult {
  donorId: string;
  distanceKm: number;
  score: number;
}

/** Spec 5.5 step 2: score from 0 to 100. */
export function scoreDonor(params: {
  donorGroup: BloodGroup;
  requestGroup: BloodGroup;
  distanceKm: number;
  radiusKm: number;
  bloodGroupVerified: boolean;
}): number {
  let score = 0;
  if (params.donorGroup === params.requestGroup) score += SCORE_EXACT_GROUP;
  const proximity = Math.max(0, 1 - params.distanceKm / params.radiusKm);
  score += SCORE_PROXIMITY_MAX * proximity;
  if (params.bloodGroupVerified) score += SCORE_VERIFIED;
  return score;
}

/**
 * Spec 5.5: filter compatible, eligible, in-range donors, score them,
 * sort highest first and keep at most 50.
 */
export function findMatches(
  request: MatchRequestInput,
  donors: readonly MatchDonorInput[],
  now: Date,
  limit: number = MAX_DONORS_NOTIFIED_PER_STEP,
): MatchResult[] {
  const center: LatLng = { lat: request.lat, lng: request.lng };
  const results: MatchResult[] = [];

  for (const donor of donors) {
    if (donor.id === request.createdById) continue;
    if (request.alreadyMatchedDonorIds.has(donor.id)) continue;
    if (donor.lat === null || donor.lng === null) continue;
    if (!canDonateTo(donor.bloodGroup, request.bloodGroup)) continue;
    if (!isEligible(donor, now).eligible) continue;

    const distanceKm = haversineKm(center, { lat: donor.lat, lng: donor.lng });
    if (distanceKm > request.radiusKm) continue;

    results.push({
      donorId: donor.id,
      distanceKm,
      score: scoreDonor({
        donorGroup: donor.bloodGroup,
        requestGroup: request.bloodGroup,
        distanceKm,
        radiusKm: request.radiusKm,
        bloodGroupVerified: donor.bloodGroupVerified,
      }),
    });
  }

  // Highest score first; ties go to the nearer donor, then by id so the order is stable.
  results.sort(
    (a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.donorId.localeCompare(b.donorId),
  );
  return results.slice(0, limit);
}
