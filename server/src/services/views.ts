import { CRITICAL_ESCALATION_AFTER_MINUTES } from "@red-link/shared/domain/constants";
import { formatPublicDistance, haversineKm } from "@red-link/shared/domain/geo";
import { maskName } from "@red-link/shared/domain/privacy";
import {
  canExpandManually,
  expandedRadiusKm,
  isActiveStatus,
  maxUnitsForDonation,
  sortFeed,
  sortMatchesForInstitution,
  unitsRemaining,
} from "@red-link/shared/domain/requests";
import type { Types } from "mongoose";
import type {
  DonationHistoryItem,
  DonationRow,
  DonorFeedItem,
  DonorRequestDetail,
  HospitalOption,
  NearbyCamp,
  NotificationsResponse,
  RequestSummary,
  RequestView,
} from "@red-link/shared/api";
import {
  ACTIVE_STATUSES,
  PENDING_MATCH_STATUSES,
  BloodRequest,
  DonationCamp,
  DonationRecord,
  Notification,
  RequestMatch,
  SupplyOffer,
  User,
} from "../models.ts";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Spec 4: "Individual request" for receivers, "Verified institution" for verified institutions. */
async function badgesFor(creatorIds: Types.ObjectId[]) {
  const users = await User.find({ _id: { $in: creatorIds } }, { role: 1, institution: 1 }).lean();
  const map = new Map<string, "INDIVIDUAL" | "VERIFIED_INSTITUTION" | null>();
  for (const u of users) {
    map.set(String(u._id), u.role === "RECEIVER" ? "INDIVIDUAL" : u.institution?.verifiedAt ? "VERIFIED_INSTITUTION" : null);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Donor
// ---------------------------------------------------------------------------

/** Spec 8 /donor feed: open matched requests, by urgency then distance. */
export async function getDonorFeed(donorId: string, now = new Date()): Promise<DonorFeedItem[]> {
  const matches = await RequestMatch.find({ donorId, status: { $in: PENDING_MATCH_STATUSES } }).lean();
  const requests = await BloodRequest.find({
    _id: { $in: matches.map((m) => m.requestId) },
    status: { $in: ACTIVE_STATUSES },
    neededBy: { $gt: now },
  }).lean();
  const byId = new Map(requests.map((r) => [String(r._id), r]));
  const badges = await badgesFor(requests.map((r) => r.createdById));
  return sortFeed(
    matches.flatMap((m) => {
      const r = byId.get(String(m.requestId));
      if (!r) return [];
      return [
        {
          matchId: String(m._id),
          requestId: String(r._id),
          matchStatus: m.status,
          bloodGroup: r.bloodGroup,
          urgency: r.urgency,
          unitsStillNeeded: unitsRemaining(r),
          hospitalName: r.hospitalName,
          distanceKm: m.distanceKm,
          distanceLabel: formatPublicDistance(m.distanceKm),
          neededBy: r.neededBy.toISOString(),
          createdAt: r.createdAt.toISOString(),
          badge: badges.get(String(r.createdById)) ?? null,
        },
      ];
    }),
  );
}

export async function getDonorRequestDetail(donorId: string, requestId: string): Promise<DonorRequestDetail | null> {
  const match = await RequestMatch.findOne({ requestId, donorId }).lean();
  if (!match) return null;
  const r = await BloodRequest.findById(requestId).lean();
  if (!r) return null;
  const badges = await badgesFor([r.createdById]);
  return {
    matchId: String(match._id),
    matchStatus: match.status,
    respondedAt: iso(match.respondedAt),
    distanceLabel: formatPublicDistance(match.distanceKm),
    request: {
      id: String(r._id),
      bloodGroup: r.bloodGroup,
      urgency: r.urgency,
      status: r.status,
      unitsNeeded: r.unitsNeeded,
      unitsFulfilled: r.unitsFulfilled,
      patientNote: r.patientNote ?? null,
      hospitalName: r.hospitalName,
      // Owner decision: once accepted, the donor sees where to go (name + address), not the requester's phone.
      hospitalAddress: match.status === "ACCEPTED" ? (r.hospitalAddress ?? null) : null,
      neededBy: r.neededBy.toISOString(),
      createdAt: r.createdAt.toISOString(),
      isOpen: isActiveStatus(r.status),
      badge: badges.get(String(r.createdById)) ?? null,
    },
  };
}

export async function getDonorHistory(donorId: string): Promise<DonationHistoryItem[]> {
  const records = await DonationRecord.find({ donorId }).sort({ donatedAt: -1 }).lean();
  const recorders = await User.find({ _id: { $in: records.map((r) => r.recordedById) } }, { name: 1, institution: 1 }).lean();
  const requests = await BloodRequest.find({ _id: { $in: records.flatMap((r) => (r.requestId ? [r.requestId] : [])) } }, { urgency: 1 }).lean();
  const recName = new Map(recorders.map((u) => [String(u._id), u.institution?.orgName ?? u.name]));
  const urgency = new Map(requests.map((r) => [String(r._id), r.urgency]));
  return records.map((r) => ({
    id: String(r._id),
    donatedAt: r.donatedAt.toISOString(),
    units: r.units,
    location: r.location,
    recordedBy: recName.get(String(r.recordedById)) ?? "",
    requestUrgency: r.requestId ? (urgency.get(String(r.requestId)) ?? null) : null,
  }));
}

/** "Nearby upcoming camps" = within 25 km and not yet ended (docs/DECISIONS.md). */
export const NEARBY_CAMP_RADIUS_KM = 25;

export async function getNearbyCamps(at: { lat: number | null; lng: number | null }, now = new Date()): Promise<NearbyCamp[]> {
  if (at.lat === null || at.lng === null) return [];
  const origin = { lat: at.lat, lng: at.lng };
  const camps = await DonationCamp.find({ endsAt: { $gt: now } }).sort({ startsAt: 1 }).lean();
  const banks = await User.find({ _id: { $in: camps.map((c) => c.bloodBankId) } }, { institution: 1, name: 1, status: 1 }).lean();
  const bankName = new Map(banks.map((b) => [String(b._id), b.institution?.orgName ?? b.name]));
  // Camps of a suspended blood bank are hidden (and reappear if it is reactivated).
  const activeBanks = new Set(banks.filter((b) => b.status === "ACTIVE").map((b) => String(b._id)));
  return camps
    .filter((c) => activeBanks.has(String(c.bloodBankId)))
    .map((c) => ({ c, d: haversineKm(origin, c) }))
    .filter(({ d }) => d <= NEARBY_CAMP_RADIUS_KM)
    .map(({ c, d }) => ({
      id: String(c._id),
      title: c.title,
      description: c.description,
      address: c.address,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      organiser: bankName.get(String(c.bloodBankId)) ?? "Blood bank",
      distanceLabel: formatPublicDistance(d),
    }));
}

// ---------------------------------------------------------------------------
// Hospital / Emergency / Receiver requests
// ---------------------------------------------------------------------------

export async function summaries(filter: Record<string, unknown>, limit = 0): Promise<RequestSummary[]> {
  const requests = await BloodRequest.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const counts = await RequestMatch.aggregate<{ _id: { r: Types.ObjectId; s: string }; n: number }>([
    { $match: { requestId: { $in: requests.map((r) => r._id) } } },
    { $group: { _id: { r: "$requestId", s: "$status" }, n: { $sum: 1 } } },
  ]);
  const count = (id: unknown, s?: string) =>
    counts.filter((c) => String(c._id.r) === String(id) && (!s || c._id.s === s)).reduce((a, c) => a + c.n, 0);
  return requests.map((r) => ({
    id: String(r._id),
    bloodGroup: r.bloodGroup,
    urgency: r.urgency,
    status: r.status,
    isOpen: isActiveStatus(r.status),
    unitsNeeded: r.unitsNeeded,
    unitsFulfilled: r.unitsFulfilled,
    hospitalName: r.hospitalName,
    neededBy: r.neededBy.toISOString(),
    createdAt: r.createdAt.toISOString(),
    matchedCount: count(r._id),
    acceptedCount: count(r._id, "ACCEPTED"),
    donatedCount: count(r._id, "DONATED"),
  }));
}

export const getOwnRequests = (userId: string) => summaries({ createdById: userId });
/** Receiver-raised requests where this hospital records donations (owner decision). */
export const getHospitalPatientRequests = (hospitalId: string) => summaries({ recordingHospitalId: hospitalId });

/**
 * Spec 7.A step 4. Privacy (decision #3): full name + phone only for donors who accepted or
 * donated; everyone else masked; donor coordinates are never sent.
 */
export async function getRequestView(viewer: { id: string; role: string }, requestId: string): Promise<RequestView | null> {
  const r = await BloodRequest.findById(requestId).lean();
  if (!r) return null;
  const isAdmin = viewer.role === "ADMIN";
  const isCreator = String(r.createdById) === viewer.id;
  const isRecordingHospital = String(r.recordingHospitalId) === viewer.id;
  // Spec 4: admins see every request (read-only) with the phones of donors who accepted.
  if (!isCreator && !isRecordingHospital && !isAdmin) return null;

  const [creator, matchRows, offers, recordingHospital] = await Promise.all([
    User.findById(r.createdById, { role: 1, name: 1, email: 1, institution: 1 }).lean(),
    RequestMatch.find({ requestId }).lean(),
    SupplyOffer.find({ requestId }).sort({ createdAt: -1 }).lean(),
    isAdmin && r.recordingHospitalId ? User.findById(r.recordingHospitalId, { name: 1, institution: 1 }).lean() : null,
  ]);
  const donors = await User.find({ _id: { $in: matchRows.map((m) => m.donorId) } }, { name: 1, phone: 1, donorProfile: 1 }).lean();
  const donorById = new Map(donors.map((d) => [String(d._id), d]));
  const banks = await User.find({ _id: { $in: offers.map((o) => o.bloodBankId) } }, { name: 1, institution: 1 }).lean();
  const bankName = new Map(banks.map((b) => [String(b._id), b.institution?.orgName ?? b.name]));

  const canRecord = isRecordingHospital || (isCreator && (viewer.role === "HOSPITAL" || viewer.role === "EMERGENCY"));
  const open = isActiveStatus(r.status);
  const canExpand = isCreator && canExpandManually(r);

  const matches = sortMatchesForInstitution(matchRows).map((m) => {
    const d = donorById.get(String(m.donorId));
    const revealed = m.status === "ACCEPTED" || m.status === "DONATED";
    return {
      id: String(m._id),
      status: m.status,
      score: Math.round(m.score),
      distanceLabel: formatPublicDistance(m.distanceKm),
      bloodGroup: d?.donorProfile?.bloodGroup ?? "",
      verified: d?.donorProfile?.bloodGroupVerified ?? false,
      respondedAt: iso(m.respondedAt),
      displayName: revealed ? (d?.name ?? "") : maskName(d?.name ?? ""),
      phone: revealed ? (d?.phone ?? null) : null,
      donorId: m.status === "ACCEPTED" ? String(m.donorId) : null,
    };
  });

  return {
    request: {
      id: String(r._id),
      bloodGroup: r.bloodGroup,
      urgency: r.urgency,
      status: r.status,
      isOpen: open,
      unitsNeeded: r.unitsNeeded,
      unitsFulfilled: r.unitsFulfilled,
      maxUnitsPerDonation: maxUnitsForDonation(r),
      patientNote: r.patientNote ?? null,
      hospitalName: r.hospitalName,
      hospitalAddress: r.hospitalAddress ?? null,
      radiusKm: r.radiusKm,
      neededBy: r.neededBy.toISOString(),
      createdAt: r.createdAt.toISOString(),
      fulfilledAt: iso(r.fulfilledAt),
      raisedBy: creator?.role === "RECEIVER" ? creator.name : null,
      lastEscalatedAt: iso(r.lastEscalatedAt),
      escalationDueAt:
        r.urgency === "CRITICAL" && open && !r.lastEscalatedAt
          ? new Date(r.createdAt.getTime() + CRITICAL_ESCALATION_AFTER_MINUTES * 60_000).toISOString()
          : null,
    },
    viewer: {
      canRecord,
      isRecordingHospital,
      canExpand,
      nextRadiusKm: canExpand ? expandedRadiusKm(r.radiusKm) : null,
      canCancel: open && (isCreator || isRecordingHospital),
      // Owner decision: on a receiver's request the receiver or the chosen hospital answers offers.
      canRespondOffers: open && (isCreator || isRecordingHospital),
      canReportDonors: isCreator || isRecordingHospital,
      canReportRequest: isRecordingHospital && creator?.role === "RECEIVER",
      isAdmin,
    },
    admin: isAdmin
      ? {
          createdBy: {
            name: creator?.institution?.orgName ?? creator?.name ?? "",
            role: creator?.role ?? "",
            email: creator?.email ?? "",
          },
          recordingHospital: recordingHospital ? (recordingHospital.institution?.orgName ?? recordingHospital.name) : null,
        }
      : null,
    supplyOffers: offers.map((o) => ({
      id: String(o._id),
      bankName: bankName.get(String(o.bloodBankId)) ?? "Blood bank",
      bloodGroup: o.bloodGroup,
      units: o.units,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    matches,
    counts: {
      accepted: matches.filter((m) => m.status === "ACCEPTED").length,
      notified: matches.filter((m) => m.status === "NOTIFIED").length,
      declined: matches.filter((m) => m.status === "DECLINED").length,
      donated: matches.filter((m) => m.status === "DONATED").length,
    },
  };
}

/** Donations recorded by this hospital / emergency service / blood bank. */
export async function getDonationsRecordedBy(userId: string): Promise<DonationRow[]> {
  const records = await DonationRecord.find({ recordedById: userId }).sort({ donatedAt: -1 }).lean();
  const donors = await User.find({ _id: { $in: records.map((r) => r.donorId) } }, { name: 1, donorProfile: 1 }).lean();
  const byId = new Map(donors.map((d) => [String(d._id), d]));
  return records.map((r) => ({
    id: String(r._id),
    donatedAt: r.donatedAt.toISOString(),
    donorName: byId.get(String(r.donorId))?.name ?? "",
    bloodGroup: byId.get(String(r.donorId))?.donorProfile?.bloodGroup ?? "",
    units: r.units,
    location: r.location,
    requestId: r.requestId ? String(r.requestId) : null,
  }));
}

/** Verified, active hospitals a receiver can choose, nearest first. */
export async function getVerifiedHospitals(near: { lat: number | null; lng: number | null }): Promise<HospitalOption[]> {
  const rows = await User.find(
    { role: "HOSPITAL", status: "ACTIVE", "institution.verifiedAt": { $ne: null }, lat: { $ne: null }, lng: { $ne: null } },
    { address: 1, city: 1, lat: 1, lng: 1, institution: 1 },
  ).lean();
  const origin = near.lat !== null && near.lng !== null ? { lat: near.lat, lng: near.lng } : null;
  return rows
    .map((h) => ({
      id: String(h._id),
      name: h.institution?.orgName ?? "Hospital",
      address: [h.address, h.city].filter(Boolean).join(", "),
      distanceKm: origin ? haversineKm(origin, { lat: h.lat!, lng: h.lng! }) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .map((h) => ({ ...h, distanceLabel: h.distanceKm === null ? null : formatPublicDistance(h.distanceKm) }));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotificationsFor(userId: string, limit = 50): Promise<NotificationsResponse> {
  const [items, unreadCount, urgent] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId, readAt: null }),
    Notification.find({ userId, readAt: null, priority: { $in: ["URGENT", "CRITICAL"] } }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  const shape = (n: (typeof items)[number]) => ({
    id: String(n._id),
    type: n.type,
    priority: n.priority,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  });
  return { notifications: items.map(shape), unreadCount, urgent: urgent.map(shape) };
}
