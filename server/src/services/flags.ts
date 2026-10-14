import { BLOOD_BANK_SUPPLY_RADIUS_KM } from "@red-link/shared/domain/constants";
import { haversineKm } from "@red-link/shared/domain/geo";
import type { CreateFlagInput } from "@red-link/shared/validators";
import { isValidObjectId } from "mongoose";
import type { CurrentUser } from "../auth.ts";
import { transaction } from "../db.ts";
import { HttpError } from "../http.ts";
import { BloodRequest, ContactRequest, Flag, RequestMatch, User } from "../models.ts";
import { notify } from "../notify.ts";

const notFound = () => new HttpError(404, "We couldn't find what you're reporting.");
const validId = (id: string) => {
  if (!isValidObjectId(id)) throw notFound();
  return id;
};

/**
 * Works out who and what a report is about, and checks the reporter actually dealt with it
 * (owner decision: request pages + people cards):
 * - REQUEST: a donor alerted for it, the chosen hospital on a receiver's request, or a blood
 *   bank that can see it (within 50 km). Reports the request and its creator.
 * - MATCH: the requester or chosen hospital reporting a donor who accepted / donated.
 * - CONTACT: either side of a contact request reporting the other person.
 */
async function resolveTarget(reporter: CurrentUser, input: CreateFlagInput): Promise<{ targetUserId: string; requestId: string | null }> {
  if (input.kind === "REQUEST") {
    const r = await BloodRequest.findById(validId(input.requestId)).lean();
    if (!r) throw notFound();
    if (String(r.createdById) === reporter.id) throw new HttpError(400, "You can't report your own request.");
    const allowed =
      (reporter.role === "DONOR" && (await RequestMatch.exists({ requestId: r._id, donorId: reporter.id }))) ||
      String(r.recordingHospitalId) === reporter.id ||
      (reporter.role === "BLOOD_BANK" &&
        reporter.lat !== null &&
        reporter.lng !== null &&
        haversineKm({ lat: reporter.lat, lng: reporter.lng }, r) <= BLOOD_BANK_SUPPLY_RADIUS_KM);
    if (!allowed) throw notFound();
    return { targetUserId: String(r.createdById), requestId: String(r._id) };
  }

  if (input.kind === "MATCH") {
    const m = await RequestMatch.findById(validId(input.matchId)).lean();
    const r = m ? await BloodRequest.findById(m.requestId).lean() : null;
    if (!m || !r) throw notFound();
    if (String(r.createdById) !== reporter.id && String(r.recordingHospitalId) !== reporter.id) throw notFound();
    if (m.status !== "ACCEPTED" && m.status !== "DONATED") {
      throw new HttpError(409, "You can only report donors who accepted this request.");
    }
    return { targetUserId: String(m.donorId), requestId: String(r._id) };
  }

  const c = await ContactRequest.findById(validId(input.contactRequestId)).lean();
  if (!c) throw notFound();
  if (String(c.receiverId) === reporter.id) return { targetUserId: String(c.donorId), requestId: null };
  if (String(c.donorId) === reporter.id) return { targetUserId: String(c.receiverId), requestId: null };
  throw notFound();
}

/** POST /api/flags: report a user or request (spec 4). Admins are notified. */
export async function createFlag(reporter: CurrentUser, input: CreateFlagInput) {
  return transaction(async (ctx) => {
    const { targetUserId, requestId } = await resolveTarget(reporter, input);
    if (targetUserId === reporter.id) throw new HttpError(400, "You can't report yourself.");
    if (await Flag.exists({ reporterId: reporter.id, targetUserId, requestId, status: "OPEN" })) {
      throw new HttpError(409, "You've already reported this. An admin will review it soon.");
    }
    const [flag] = await Flag.create([{ reporterId: reporter.id, targetUserId, requestId, reason: input.reason }]);
    const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }, { _id: 1 }).lean();
    await notify(
      admins.map((a) => String(a._id)),
      {
        type: "SYSTEM",
        title: "New report to review",
        body: `${reporter.institution?.orgName ?? reporter.name} reported a ${input.kind === "REQUEST" ? "request" : "user"}: "${input.reason.slice(0, 80)}${input.reason.length > 80 ? "…" : ""}"`,
        link: "/admin/flags",
      },
      ctx,
    );
    return { id: String(flag._id) };
  });
}
