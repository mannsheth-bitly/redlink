import type { AdminRequestRow, AdminStats, AdminUserRow, FlagItem, VerificationItem } from "@red-link/shared/api";
import {
  averageFirstAcceptanceMinutes,
  dailySeries,
  fulfilmentRate,
  startOfIstDay,
  startOfIstMonth,
} from "@red-link/shared/domain/analytics";
import { BLOOD_GROUPS, type FlagStatus, type RequestStatus, type Role, type UserStatus } from "@red-link/shared/domain/constants";
import {
  flagOutcome,
  flagOutcomeMessage,
  userStatusChange,
  verificationOutcome,
  type FlagAction,
  type UserAction,
  type VerificationAction,
} from "@red-link/shared/domain/moderation";
import { maskName } from "@red-link/shared/domain/privacy";
import { isActiveStatus } from "@red-link/shared/domain/requests";
import type { Types } from "mongoose";
import type { CurrentUser } from "../auth.ts";
import { transaction, type TxContext } from "../db.ts";
import { HttpError } from "../http.ts";
import {
  ACTIVE_STATUSES,
  BloodRequest,
  ContactRequest,
  Flag,
  PENDING_MATCH_STATUSES,
  RequestMatch,
  SupplyOffer,
  User,
} from "../models.ts";
import { notify } from "../notify.ts";
import { closeRequest } from "./lifecycle.ts";
import { requestFollowers } from "./requests.ts";
import { getPublicStats } from "./stats.ts";
import { summaries } from "./views.ts";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const ACCEPTED_OR_DONATED: ("ACCEPTED" | "DONATED")[] = ["ACCEPTED", "DONATED"];

// ---------------------------------------------------------------------------
// Analytics (spec 8 /admin)
// ---------------------------------------------------------------------------

export async function getAdminStats(now = new Date()): Promise<AdminStats> {
  const since14 = startOfIstDay(now, 13);
  const [publicStats, byStatus, fulfilledThisMonth, byGroup, recent, firstAccepts, verifications, openFlags] = await Promise.all([
    getPublicStats(now),
    BloodRequest.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    BloodRequest.countDocuments({ status: "FULFILLED", fulfilledAt: { $gte: startOfIstMonth(now) } }),
    BloodRequest.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$bloodGroup", n: { $sum: 1 } } }]),
    BloodRequest.find({ $or: [{ createdAt: { $gte: since14 } }, { fulfilledAt: { $gte: since14 } }] }, { createdAt: 1, fulfilledAt: 1 }).lean(),
    // Earliest acceptance per request (accepted, or accepted and then donated).
    RequestMatch.aggregate<{ _id: Types.ObjectId; first: Date }>([
      { $match: { status: { $in: ACCEPTED_OR_DONATED }, respondedAt: { $ne: null } } },
      { $group: { _id: "$requestId", first: { $min: "$respondedAt" } } },
    ]),
    User.countDocuments({ status: "PENDING_VERIFICATION" }),
    Flag.countDocuments({ status: "OPEN" }),
  ]);
  const count = (s: string) => byStatus.find((x) => x._id === s)?.n ?? 0;
  const created = await BloodRequest.find({ _id: { $in: firstAccepts.map((f) => f._id) } }, { createdAt: 1 }).lean();
  const createdAt = new Map(created.map((r) => [String(r._id), r.createdAt]));
  const closed = { fulfilled: count("FULFILLED"), cancelled: count("CANCELLED"), expired: count("EXPIRED") };

  return {
    totals: {
      donors: publicStats.registeredDonors,
      availableNow: publicStats.donorsReadyNow,
      openRequests: count("OPEN") + count("PARTIALLY_FULFILLED"),
      fulfilledThisMonth,
      fulfilmentRate: fulfilmentRate(closed),
      closedRequests: closed.fulfilled + closed.cancelled + closed.expired,
      avgFirstAcceptanceMinutes: averageFirstAcceptanceMinutes(
        firstAccepts.flatMap((f) => {
          const c = createdAt.get(String(f._id));
          return c ? [{ createdAt: c, firstAcceptedAt: f.first }] : [];
        }),
      ),
    },
    byBloodGroup: BLOOD_GROUPS.map((g) => ({ bloodGroup: g, requests: byGroup.find((x) => x._id === g)?.n ?? 0 })),
    last14Days: dailySeries(
      recent.map((r) => ({ createdAt: r.createdAt, fulfilledAt: r.fulfilledAt ?? null })),
      now,
    ),
    pending: { verifications, openFlags },
  };
}

// ---------------------------------------------------------------------------
// Verification queue (spec 7.C)
// ---------------------------------------------------------------------------

export async function listVerifications(): Promise<{ pending: VerificationItem[]; rejected: VerificationItem[] }> {
  const rows = await User.find({ status: { $in: ["PENDING_VERIFICATION", "REJECTED"] }, institution: { $ne: null } })
    .sort({ createdAt: 1 })
    .lean();
  const shape = (u: (typeof rows)[number]): VerificationItem => ({
    id: String(u._id),
    role: u.role,
    status: u.status,
    orgName: u.institution?.orgName ?? "",
    licenseNumber: u.institution?.licenseNumber ?? "",
    contactName: u.name,
    email: u.email,
    phone: u.phone,
    address: [u.address, u.city, u.pincode].filter(Boolean).join(", "),
    appliedAt: u.createdAt.toISOString(),
    decidedAt: iso(u.institution?.verifiedAt),
    rejectionNote: u.institution?.rejectionNote ?? null,
  });
  return {
    pending: rows.filter((u) => u.status === "PENDING_VERIFICATION").map(shape),
    rejected: rows.filter((u) => u.status === "REJECTED").map(shape).reverse(),
  };
}

/** Spec 7.C step 2: approve (ACTIVE, verifiedAt set) or reject with a note; the applicant is notified. */
export async function decideVerification(admin: CurrentUser, userId: string, action: VerificationAction, note: string | null, now = new Date()) {
  return transaction(async (ctx) => {
    const user = await User.findById(userId, { role: 1, status: 1, institution: 1 }).lean();
    if (!user?.institution) throw new HttpError(404, "Application not found.");
    const outcome = verificationOutcome(user, action, note);
    if ("error" in outcome) throw new HttpError(409, outcome.error);

    const { modifiedCount } = await User.updateOne(
      { _id: user._id, status: "PENDING_VERIFICATION" },
      action === "APPROVE"
        ? { status: outcome.status, "institution.verifiedAt": now, "institution.verifiedById": admin.id, "institution.rejectionNote": null }
        : { status: outcome.status, "institution.rejectionNote": note },
    );
    if (modifiedCount === 0) throw new HttpError(409, "This application was just reviewed. Refresh the page.");

    await notify(
      [userId],
      action === "APPROVE"
        ? {
            type: "VERIFICATION",
            title: "Organisation verified",
            body: "Your organisation has been verified. You can now use all Red Link features.",
          }
        : {
            type: "VERIFICATION",
            title: "Verification not approved",
            body: `Your application was not approved. Admin note: "${note}"`,
          },
      ctx,
    );
    return { status: outcome.status };
  });
}

// ---------------------------------------------------------------------------
// User management (spec 8 /admin/users)
// ---------------------------------------------------------------------------

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const USER_LIST_LIMIT = 100;

export async function listUsers(query: { q?: string; role?: Role; status?: UserStatus }): Promise<{ users: AdminUserRow[]; total: number; limit: number }> {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    const digits = query.q.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
    filter.$or = [
      { name: rx },
      { email: rx },
      { "institution.orgName": rx },
      ...(/^\d{3,10}$/.test(digits) ? [{ phone: new RegExp(escapeRegex(digits)) }] : []),
    ];
  }
  const [rows, total] = await Promise.all([
    User.find(filter, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(USER_LIST_LIMIT).lean(),
    User.countDocuments(filter),
  ]);
  const flags = await Flag.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: "OPEN", targetUserId: { $in: rows.map((r) => r._id) } } },
    { $group: { _id: "$targetUserId", n: { $sum: 1 } } },
  ]);
  const flagCount = new Map(flags.map((f) => [String(f._id), f.n]));
  return {
    users: rows.map((u) => ({
      id: String(u._id),
      role: u.role as Role,
      status: u.status,
      name: u.name,
      email: u.email,
      phone: u.phone,
      city: u.city ?? null,
      createdAt: u.createdAt.toISOString(),
      orgName: u.institution?.orgName ?? null,
      bloodGroup: u.donorProfile?.bloodGroup ?? null,
      bloodGroupVerified: u.donorProfile?.bloodGroupVerified ?? false,
      openFlags: flagCount.get(String(u._id)) ?? 0,
    })),
    total,
    limit: USER_LIST_LIMIT,
  };
}

export interface SuspensionSummary {
  cancelledRequests: number;
  withdrawnMatches: number;
  declinedContacts: number;
  withdrawnOffers: number;
}

/**
 * Owner decision ("clean up + block"). Runs inside the suspension transaction:
 * - donor: withdrawn from requests they were alerted for / accepted (requesters told when they
 *   had accepted); pending contact requests declined (receivers told politely);
 * - receiver / hospital / emergency: their open requests are cancelled (donors told);
 *   a receiver's pending contact requests are closed;
 * - hospital: open patient requests that chose it are cancelled (the receiver is told why);
 * - blood bank: pending supply offers withdrawn (requesters told); its camps are hidden.
 */
async function cleanUpAfterSuspension(
  ctx: TxContext,
  user: { _id: Types.ObjectId; role: string; name: string; institution?: { orgName: string } | null },
  now: Date,
): Promise<SuspensionSummary> {
  const userId = String(user._id);
  const summary: SuspensionSummary = { cancelledRequests: 0, withdrawnMatches: 0, declinedContacts: 0, withdrawnOffers: 0 };

  if (user.role === "DONOR") {
    const matches = await RequestMatch.find({ donorId: userId, status: { $in: PENDING_MATCH_STATUSES } }).lean();
    for (const m of matches) {
      const { modifiedCount } = await RequestMatch.updateOne({ _id: m._id, status: m.status }, { status: "DECLINED", respondedAt: now });
      if (modifiedCount === 0) continue;
      summary.withdrawnMatches += 1;
      const r = await BloodRequest.findById(m.requestId).lean();
      if (m.status !== "ACCEPTED" || !r || !isActiveStatus(r.status)) continue;
      for (const f of await requestFollowers(r)) {
        await notify(
          [f.userId],
          {
            type: "REQUEST_UPDATE",
            title: `A donor withdrew from the ${r.bloodGroup} request`,
            body: `${user.name} is no longer available on Red Link.`,
            link: f.link,
          },
          ctx,
        );
      }
    }
    const contacts = await ContactRequest.find({ donorId: userId, status: "PENDING" }, { receiverId: 1 }).lean();
    if (contacts.length) {
      await ContactRequest.updateMany({ donorId: userId, status: "PENDING" }, { status: "DECLINED", respondedAt: now });
      summary.declinedContacts += contacts.length;
      await notify(
        contacts.map((c) => String(c.receiverId)),
        {
          type: "CONTACT_RESPONSE",
          title: "Contact request declined",
          body: `${maskName(user.name)} isn't able to help right now. Thank you for understanding. Try another donor or raise a request.`,
          link: "/receiver/contacts",
        },
        ctx,
      );
    }
  }

  if (user.role === "RECEIVER" || user.role === "HOSPITAL" || user.role === "EMERGENCY") {
    const own = await BloodRequest.find({ createdById: userId, status: { $in: ACTIVE_STATUSES } }).lean();
    for (const r of own) {
      if (await closeRequest(ctx, r, "CANCELLED", { reason: "Closed by a Red Link admin", actorId: userId })) summary.cancelledRequests += 1;
    }
  }

  if (user.role === "RECEIVER") {
    const { modifiedCount } = await ContactRequest.updateMany({ receiverId: userId, status: "PENDING" }, { status: "DECLINED", respondedAt: now });
    summary.declinedContacts += modifiedCount;
  }

  if (user.role === "HOSPITAL") {
    const patient = await BloodRequest.find({ recordingHospitalId: userId, status: { $in: ACTIVE_STATUSES } }).lean();
    for (const r of patient) {
      const reason = "The chosen hospital is no longer available on Red Link. Please raise a new request with another hospital";
      if (await closeRequest(ctx, r, "CANCELLED", { reason, actorId: userId })) summary.cancelledRequests += 1;
    }
  }

  if (user.role === "BLOOD_BANK") {
    const offers = await SupplyOffer.find({ bloodBankId: userId, status: "PENDING" }).lean();
    const bankName = user.institution?.orgName ?? user.name;
    for (const o of offers) {
      const { modifiedCount } = await SupplyOffer.updateOne({ _id: o._id, status: "PENDING" }, { status: "DECLINED" });
      if (modifiedCount === 0) continue;
      summary.withdrawnOffers += 1;
      const r = await BloodRequest.findById(o.requestId).lean();
      if (!r || !isActiveStatus(r.status)) continue;
      for (const f of await requestFollowers(r)) {
        await notify(
          [f.userId],
          { type: "SUPPLY_OFFER", title: "A supply offer was withdrawn", body: `${bankName}'s offer for the ${r.bloodGroup} request is no longer available.`, link: f.link },
          ctx,
        );
      }
    }
  }
  return summary;
}

/** Suspends inside an existing transaction. Returns null when the account wasn't ACTIVE any more. */
async function suspendInTransaction(ctx: TxContext, admin: CurrentUser, userId: string, now: Date) {
  const user = await User.findById(userId, { role: 1, status: 1, name: 1, institution: 1 }).lean();
  if (!user) throw new HttpError(404, "User not found.");
  const change = userStatusChange({ id: userId, role: user.role, status: user.status }, admin.id, "SUSPEND");
  if ("error" in change) throw new HttpError(409, change.error);
  const { modifiedCount } = await User.updateOne({ _id: user._id, status: change.from }, { status: change.to });
  if (modifiedCount === 0) throw new HttpError(409, "This account was just changed. Refresh the page.");
  return cleanUpAfterSuspension(ctx, user, now);
}

export async function changeUserStatus(admin: CurrentUser, userId: string, action: UserAction, now = new Date()) {
  if (action === "SUSPEND") {
    const summary = await transaction((ctx) => suspendInTransaction(ctx, admin, userId, now));
    return { status: "SUSPENDED" as const, summary };
  }
  return transaction(async (ctx) => {
    const user = await User.findById(userId, { role: 1, status: 1 }).lean();
    if (!user) throw new HttpError(404, "User not found.");
    const change = userStatusChange({ id: userId, role: user.role, status: user.status }, admin.id, action);
    if ("error" in change) throw new HttpError(409, change.error);
    const { modifiedCount } = await User.updateOne({ _id: user._id, status: change.from }, { status: change.to });
    if (modifiedCount === 0) throw new HttpError(409, "This account was just changed. Refresh the page.");
    await notify(
      [userId],
      { type: "SYSTEM", title: "Account reactivated", body: "A Red Link admin has reactivated your account. Welcome back." },
      ctx,
    );
    return { status: "ACTIVE" as const, summary: null };
  });
}

// ---------------------------------------------------------------------------
// Flags (spec 8 /admin/flags)
// ---------------------------------------------------------------------------

export async function listFlags(status: FlagStatus | undefined): Promise<FlagItem[]> {
  const flags = await Flag.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200).lean();
  const userIds = flags.flatMap((f) => [f.reporterId, ...(f.targetUserId ? [f.targetUserId] : [])]);
  const [users, requests] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { name: 1, role: 1, status: 1, institution: 1 }).lean(),
    BloodRequest.find({ _id: { $in: flags.flatMap((f) => (f.requestId ? [f.requestId] : [])) } }, { bloodGroup: 1, hospitalName: 1, status: 1 }).lean(),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const requestById = new Map(requests.map((r) => [String(r._id), r]));
  const displayName = (u: (typeof users)[number] | undefined) => u?.institution?.orgName ?? u?.name ?? "Deleted user";

  return flags.map((f) => {
    const reporter = userById.get(String(f.reporterId));
    const target = f.targetUserId ? userById.get(String(f.targetUserId)) : undefined;
    const request = f.requestId ? requestById.get(String(f.requestId)) : undefined;
    return {
      id: String(f._id),
      status: f.status,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
      reporter: { id: String(f.reporterId), name: displayName(reporter), role: reporter?.role ?? "" },
      target: f.targetUserId
        ? { id: String(f.targetUserId), name: displayName(target), role: target?.role ?? "", status: target?.status ?? "" }
        : null,
      request: request ? { id: String(request._id), bloodGroup: request.bloodGroup, hospitalName: request.hospitalName, status: request.status } : null,
      resolutionNote: f.resolutionNote ?? null,
      resolvedAt: iso(f.resolvedAt),
    };
  });
}

/** Owner decision: Resolve / Dismiss / Suspend user & resolve, optional note, reporter notified. */
export async function reviewFlag(admin: CurrentUser, flagId: string, action: FlagAction, note: string | null, now = new Date()) {
  return transaction(async (ctx) => {
    const flag = await Flag.findById(flagId).lean().catch(() => null);
    if (!flag) throw new HttpError(404, "Report not found.");
    const outcome = flagOutcome({ status: flag.status, hasTarget: flag.targetUserId !== null }, action);
    if ("error" in outcome) throw new HttpError(409, outcome.error);

    const { modifiedCount } = await Flag.updateOne(
      { _id: flag._id, status: "OPEN" },
      { status: outcome.status, resolvedAt: now, resolvedById: admin.id, resolutionNote: note },
    );
    if (modifiedCount === 0) throw new HttpError(409, "This report was just reviewed. Refresh the page.");

    let summary: SuspensionSummary | null = null;
    if (outcome.suspendTarget && flag.targetUserId) {
      summary = await suspendInTransaction(ctx, admin, String(flag.targetUserId), now);
    }
    const message = flagOutcomeMessage(action, note);
    await notify([String(flag.reporterId)], { type: "SYSTEM", ...message }, ctx);
    return { status: outcome.status, summary };
  });
}

// ---------------------------------------------------------------------------
// All requests (owner decision: read-only admin list)
// ---------------------------------------------------------------------------

const ADMIN_REQUEST_LIMIT = 200;

export async function listAllRequests(status: "ACTIVE" | RequestStatus | undefined): Promise<AdminRequestRow[]> {
  const filter = status === "ACTIVE" ? { status: { $in: ACTIVE_STATUSES } } : status ? { status } : {};
  const rows = await summaries(filter, ADMIN_REQUEST_LIMIT);
  const requests = await BloodRequest.find({ _id: { $in: rows.map((r) => r.id) } }, { createdById: 1 }).lean();
  const creatorOf = new Map(requests.map((r) => [String(r._id), String(r.createdById)]));
  const creators = await User.find({ _id: { $in: requests.map((r) => r.createdById) } }, { name: 1, role: 1, institution: 1 }).lean();
  const creatorById = new Map(creators.map((c) => [String(c._id), c]));
  return rows.map((r) => {
    const c = creatorById.get(creatorOf.get(r.id) ?? "");
    return { ...r, createdByName: c?.institution?.orgName ?? c?.name ?? "", createdByRole: c?.role ?? "" };
  });
}
