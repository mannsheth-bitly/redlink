import type { ContactRequestItem } from "@red-link/shared/api";
import { canSendContactRequest, maskName, nextContactStatus } from "@red-link/shared/domain/privacy";
import type { CurrentUser } from "../auth.ts";
import { transaction } from "../db.ts";
import { HttpError } from "../http.ts";
import { ContactRequest, User } from "../models.ts";
import { notify } from "../notify.ts";

/** Spec 7.B step 3: receiver sends a short message; the donor is notified. */
export async function createContactRequest(receiver: CurrentUser, donorId: string, message: string) {
  return transaction(async (ctx) => {
    const donor = await User.findById(donorId, { role: 1, status: 1 }).lean().catch(() => null);
    if (!donor || donor.role !== "DONOR" || donor.status !== "ACTIVE") throw new HttpError(404, "Donor not found.");
    const existing = await ContactRequest.find({ receiverId: receiver.id, donorId }, { status: 1 }).lean();
    const allowed = canSendContactRequest(existing.map((e) => e.status));
    if ("error" in allowed) throw new HttpError(409, allowed.error);

    const [created] = await ContactRequest.create([{ receiverId: receiver.id, donorId, message }]);
    await notify(
      [donorId],
      {
        type: "CONTACT_REQUEST",
        title: "Someone is asking to contact you",
        body: `${receiver.name} needs blood and would like your phone number.`,
        link: "/donor/contacts",
      },
      ctx,
    );
    return { id: String(created._id) };
  });
}

/** Spec 7.B step 4: on accept both numbers become visible; on decline the receiver is told politely. */
export async function respondToContactRequest(donor: CurrentUser, id: string, action: "ACCEPT" | "DECLINE") {
  return transaction(async (ctx) => {
    const request = await ContactRequest.findById(id).lean();
    if (!request || String(request.donorId) !== donor.id) throw new HttpError(404, "Contact request not found.");
    const next = nextContactStatus(request.status, action);
    if ("error" in next) throw new HttpError(409, next.error);
    const { modifiedCount } = await ContactRequest.updateOne(
      { _id: id, status: "PENDING" },
      { status: next.status, respondedAt: new Date() },
    );
    if (modifiedCount === 0) throw new HttpError(409, "You've already responded to this contact request.");
    await notify(
      [String(request.receiverId)],
      next.status === "ACCEPTED"
        ? {
            type: "CONTACT_RESPONSE",
            title: "A donor shared their number",
            body: `${donor.name} accepted your request. You can now see their phone number.`,
            link: "/receiver/contacts",
          }
        : {
            type: "CONTACT_RESPONSE",
            title: "Contact request declined",
            body: `${maskName(donor.name)} isn't able to help right now. Thank you for understanding. Try another donor or raise a request.`,
            link: "/receiver/contacts",
          },
      ctx,
    );
    return { status: next.status };
  });
}

/** Role-aware list. Phone numbers ONLY for ACCEPTED requests (Phase 3 acceptance). */
export async function listContactRequests(user: CurrentUser): Promise<ContactRequestItem[]> {
  const isReceiver = user.role === "RECEIVER";
  const rows = await ContactRequest.find(isReceiver ? { receiverId: user.id } : { donorId: user.id }).sort({ createdAt: -1 }).lean();
  const others = await User.find(
    { _id: { $in: rows.map((r) => (isReceiver ? r.donorId : r.receiverId)) } },
    { name: 1, phone: 1, donorProfile: 1 },
  ).lean();
  const byId = new Map(others.map((o) => [String(o._id), o]));
  return rows.map((r) => {
    const other = byId.get(String(isReceiver ? r.donorId : r.receiverId));
    const accepted = r.status === "ACCEPTED";
    return {
      id: String(r._id),
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
      // Donors see the receiver's full name; receivers see the donor masked until they accept.
      otherName: isReceiver && !accepted ? maskName(other?.name ?? "") : (other?.name ?? ""),
      otherPhone: accepted ? (other?.phone ?? null) : null,
      bloodGroup: isReceiver ? (other?.donorProfile?.bloodGroup ?? null) : null,
      verified: isReceiver ? (other?.donorProfile?.bloodGroupVerified ?? false) : false,
    };
  });
}
