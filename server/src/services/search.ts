import type { DonorSearchResult } from "@red-link/shared/api";
import { isEligible } from "@red-link/shared/domain/eligibility";
import { formatPublicDistance, haversineKm } from "@red-link/shared/domain/geo";
import { scoreDonor } from "@red-link/shared/domain/matching";
import { maskName, snapToGrid } from "@red-link/shared/domain/privacy";
import type { DonorSearchInput } from "@red-link/shared/validators";
import { ContactRequest, User } from "../models.ts";
import { loadCandidateDonors } from "./matching.ts";

const MAX_RESULTS = 50;

/**
 * Masked donor search (spec 7.B). Only donors who can donate now (owner decision); masked
 * names, rounded distances and ~1 km grid positions. Never phones or exact coordinates.
 */
export async function searchDonors(input: DonorSearchInput, viewerId: string, now = new Date()): Promise<DonorSearchResult[]> {
  const centre = { lat: input.lat, lng: input.lng };
  const ranked = (await loadCandidateDonors(input))
    .filter((d) => d.lat !== null && d.lng !== null)
    .filter((d) => isEligible(d, now).eligible)
    .filter((d) => !input.verifiedOnly || d.bloodGroupVerified)
    .map((d) => ({ d, distanceKm: haversineKm(centre, { lat: d.lat!, lng: d.lng! }) }))
    .filter((x) => x.distanceKm <= input.radiusKm)
    .map((x) => ({
      ...x,
      score: scoreDonor({
        donorGroup: x.d.bloodGroup,
        requestGroup: input.bloodGroup,
        distanceKm: x.distanceKm,
        radiusKm: input.radiusKm,
        bloodGroupVerified: x.d.bloodGroupVerified,
      }),
    }))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
    .slice(0, MAX_RESULTS);

  const ids = ranked.map((x) => x.d.id);
  const [names, contacts] = await Promise.all([
    User.find({ _id: { $in: ids } }, { name: 1 }).lean(),
    ContactRequest.find({ receiverId: viewerId, donorId: { $in: ids } }, { donorId: 1, status: 1 }).sort({ createdAt: -1 }).lean(),
  ]);
  const nameById = new Map(names.map((n) => [String(n._id), n.name]));
  const contactByDonor = new Map<string, string>();
  for (const c of contacts) if (!contactByDonor.has(String(c.donorId))) contactByDonor.set(String(c.donorId), c.status);

  return ranked.map((x) => ({
    donorId: x.d.id,
    displayName: maskName(nameById.get(x.d.id) ?? ""),
    bloodGroup: x.d.bloodGroup,
    verified: x.d.bloodGroupVerified,
    distanceLabel: formatPublicDistance(x.distanceKm),
    approxLocation: snapToGrid({ lat: x.d.lat!, lng: x.d.lng! }),
    contactStatus: contactByDonor.get(x.d.id) ?? null,
  }));
}
