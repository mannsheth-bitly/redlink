import { compatibleDonorGroups } from "@red-link/shared/domain/compatibility";
import type { BloodGroup, Urgency } from "@red-link/shared/domain/constants";
import { boundingBox } from "@red-link/shared/domain/geo";
import { findMatches, type MatchDonorInput, type MatchResult } from "@red-link/shared/domain/matching";
import type { TxContext } from "../db.ts";
import { RequestMatch, User } from "../models.ts";
import { notify } from "../notify.ts";

/**
 * Candidate donors: compatible group, available, active, inside the lat/lng bounding box
 * (spec 5.6 prefilter). Exact distance and eligibility are checked by findMatches().
 */
export async function loadCandidateDonors(params: {
  bloodGroup: BloodGroup;
  lat: number;
  lng: number;
  radiusKm: number;
}): Promise<MatchDonorInput[]> {
  const box = boundingBox({ lat: params.lat, lng: params.lng }, params.radiusKm);
  const rows = await User.find(
    {
      role: "DONOR",
      status: "ACTIVE",
      lat: { $gte: box.minLat, $lte: box.maxLat },
      lng: { $gte: box.minLng, $lte: box.maxLng },
      "donorProfile.isAvailable": true,
      "donorProfile.bloodGroup": { $in: [...compatibleDonorGroups(params.bloodGroup)] },
    },
    { status: 1, lat: 1, lng: 1, donorProfile: 1 },
  ).lean();
  return rows.flatMap((u) =>
    u.donorProfile
      ? [
          {
            id: String(u._id),
            status: u.status,
            lat: u.lat ?? null,
            lng: u.lng ?? null,
            bloodGroup: u.donorProfile.bloodGroup as BloodGroup,
            isAvailable: u.donorProfile.isAvailable,
            bloodGroupVerified: u.donorProfile.bloodGroupVerified,
            dateOfBirth: u.donorProfile.dateOfBirth,
            weightKg: u.donorProfile.weightKg,
            lastDonationAt: u.donorProfile.lastDonationAt ?? null,
          },
        ]
      : [],
  );
}

export interface MatchableRequest {
  id: string;
  bloodGroup: BloodGroup;
  urgency: Urgency;
  unitsNeeded: number;
  hospitalName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  createdById: string;
}

/**
 * Spec 5.5: find new matches, save RequestMatch rows (NOTIFIED) and notify the donors.
 * Donors already matched to this request are skipped, so it's safe to call again after the
 * radius grows. Call inside transaction().
 */
export async function matchAndNotify(ctx: TxContext, request: MatchableRequest, now: Date): Promise<MatchResult[]> {
  const existing = await RequestMatch.find({ requestId: request.id }, { donorId: 1 }).lean();
  const donors = await loadCandidateDonors(request);
  const matches = findMatches(
    {
      bloodGroup: request.bloodGroup,
      lat: request.lat,
      lng: request.lng,
      radiusKm: request.radiusKm,
      createdById: request.createdById,
      alreadyMatchedDonorIds: new Set(existing.map((m) => String(m.donorId))),
    },
    donors,
    now,
  );
  if (matches.length === 0) return matches;

  await RequestMatch.insertMany(
    matches.map((m) => ({
      requestId: request.id,
      donorId: m.donorId,
      distanceKm: m.distanceKm,
      score: m.score,
      status: "NOTIFIED",
      notifiedAt: now,
    })),
  );
  const units = `${request.unitsNeeded} unit${request.unitsNeeded === 1 ? "" : "s"}`;
  await notify(
    matches.map((m) => m.donorId),
    {
      type: "REQUEST_MATCH",
      priority: request.urgency,
      title: `${request.urgency === "NORMAL" ? "" : `${request.urgency}: `}${request.bloodGroup} blood needed`,
      body: `${units} needed at ${request.hospitalName}. You're a compatible donor nearby.`,
      link: `/donor/requests/${request.id}`,
    },
    ctx,
  );
  return matches;
}
