// Phase 4: expand radius, CRITICAL auto-escalation (with concurrency), expiry, cancellation.
import { api, check, col, cookieFor, DAY, finish, oid, user } from "./lib.mjs";

const hospital = await cookieFor("hospital@redlink.test");
const emergency = await cookieFor("emergency@redlink.test");
const receiver = await cookieFor("receiver@redlink.test");
const donor = await cookieFor("donor@redlink.test");
const H = await user("hospital@redlink.test");
const req = (id) => col("bloodrequests").findOne({ _id: oid(id) });
const mcount = (id, f = {}) => col("requestmatches").countDocuments({ requestId: oid(id), ...f });
const emailOf = async (m) => (await col("users").findOne({ _id: m.donorId })).email;
const body = (o) => ({ unitsNeeded: 2, neededBy: new Date(Date.now() + DAY).toISOString(), hospitalName: "Vidyavihar General Hospital", hospitalAddress: "Station Road", lat: H.lat, lng: H.lng, ...o });

// Manual expand from ~40 km away so new donors really appear
const far = await api(hospital, "POST", "/api/requests", body({ bloodGroup: "B+", urgency: "URGENT", unitsNeeded: 1, lat: H.lat + 0.36 }));
for (const step of [50, 75]) {
  const e = await api(hospital, "POST", `/api/requests/${far.json.id}/expand`);
  const band = await mcount(far.json.id, { distanceKm: { $gt: step - 25, $lte: step } });
  check(e.status === 200 && e.json.radiusKm === step && e.json.newlyNotified > 0 && band === e.json.newlyNotified, `expand to ${step} km: +${e.json?.newlyNotified} donors, all in ${step - 25}–${step} km`);
}
const distinct = (await col("requestmatches").distinct("donorId", { requestId: oid(far.json.id) })).length;
check(distinct === (await mcount(far.json.id)), `no duplicate matches`);
check((await col("notifications").countDocuments({ link: `/donor/requests/${far.json.id}` })) === (await mcount(far.json.id)), `each matched donor alerted exactly once`);
check((await api(hospital, "POST", `/api/requests/${far.json.id}/expand`)).status === 409, `can't go past 75 km`);
const normal = await api(hospital, "POST", "/api/requests", body({ bloodGroup: "A+", urgency: "NORMAL" }));
check((await api(hospital, "POST", `/api/requests/${normal.json.id}/expand`)).status === 409, `NORMAL can't expand`);
check((await api(emergency, "POST", `/api/requests/${far.json.id}/expand`)).status === 404, `other institution can't expand`);
const rU = await api(receiver, "POST", "/api/requests", { bloodGroup: "O+", unitsNeeded: 1, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalId: String(H._id) });
check((await api(receiver, "POST", `/api/requests/${rU.json.id}/expand`)).json.radiusKm === 50, `receiver expands own URGENT`);
check((await api(hospital, "POST", `/api/requests/${rU.json.id}/expand`)).status === 404, `chosen hospital can't expand receiver's request`);
const fresh = await api(hospital, "POST", "/api/requests", body({ bloodGroup: "O+", urgency: "URGENT" }));
const both = await Promise.all([api(hospital, "POST", `/api/requests/${fresh.json.id}/expand`), api(hospital, "POST", `/api/requests/${fresh.json.id}/expand`)]);
const r1 = (await req(fresh.json.id)).radiusKm;
const ok200 = both.filter((b) => b.status === 200).length;
check(ok200 >= 1 && ((r1 === 50 && ok200 === 1) || (r1 === 75 && ok200 === 2)), `simultaneous double-click: radius ${r1}, ${ok200} succeeded (never skips a step)`);

// CRITICAL auto-escalation
const crit = await api(emergency, "POST", "/api/requests", body({ bloodGroup: "O+", urgency: "CRITICAL", unitsNeeded: 3, lat: H.lat + 0.45 }));
const cid = crit.json.id;
check((await req(cid)).radiusKm === 50, `CRITICAL starts at 50 km (${crit.json.matchedCount} matched)`);
await api(emergency, "GET", "/api/notifications");
check((await req(cid)).radiusKm === 50, `no escalation before 10 minutes`);
await col("bloodrequests").updateOne({ _id: oid(cid) }, { $set: { createdAt: new Date(Date.now() - 11 * 60_000) } });
const beforeEsc = await mcount(cid);
await Promise.all(Array.from({ length: 5 }, () => api(donor, "GET", "/api/notifications")));
const after = await req(cid);
check(after.radiusKm === 100 && after.lastEscalatedAt !== null, `auto-expanded to 100 km`);
const newM = (await mcount(cid)) - beforeEsc;
check(newM > 0 && (await mcount(cid, { distanceKm: { $gt: 50 } })) === newM, `${newM} new donors (50–100 km) matched`);
const E = await user("emergency@redlink.test");
check((await col("notifications").countDocuments({ userId: E._id, title: /^Search widened/ })) === 1, `escalated exactly once despite 5 simultaneous polls`);
const crit2 = await api(emergency, "POST", "/api/requests", body({ bloodGroup: "B+", urgency: "CRITICAL", unitsNeeded: 5 }));
for (const m of await col("requestmatches").find({ requestId: oid(crit2.json.id) }).sort({ score: -1 }).limit(3).toArray()) {
  await api(await cookieFor(await emailOf(m)), "POST", `/api/matches/${m._id}/respond`, { action: "ACCEPT" });
}
await col("bloodrequests").updateOne({ _id: oid(crit2.json.id) }, { $set: { createdAt: new Date(Date.now() - 11 * 60_000) } });
await api(emergency, "GET", "/api/notifications");
check((await req(crit2.json.id)).radiusKm === 50, `3 accepted -> no escalation`);

// Expiry
const exp = await api(hospital, "POST", "/api/requests", body({ bloodGroup: "A+", urgency: "URGENT" }));
const xm = await col("requestmatches").find({ requestId: oid(exp.json.id) }).sort({ score: -1 }).limit(1).next();
const xC = await cookieFor(await emailOf(xm));
await api(xC, "POST", `/api/matches/${xm._id}/respond`, { action: "ACCEPT" });
await col("bloodrequests").updateOne({ _id: oid(exp.json.id) }, { $set: { neededBy: new Date(Date.now() - 60_000) } });
await api(xC, "GET", `/api/requests/${exp.json.id}`);
check((await req(exp.json.id)).status === "EXPIRED", `past needed-by -> EXPIRED (lazy, on view)`);
check((await mcount(exp.json.id, { status: { $in: ["NOTIFIED", "ACCEPTED"] } })) === 0, `pending matches -> NO_LONGER_NEEDED`);
check((await col("notifications").countDocuments({ userId: xm.donorId, body: /needed-by time passed\. No longer needed/ })) === 1, `accepted donor told`);
check((await col("notifications").countDocuments({ userId: H._id, title: /request expired$/ })) >= 1, `creator told`);
check(!(await api(xC, "GET", "/api/donor/feed")).json.feed.some((f) => f.requestId === exp.json.id), `gone from feed`);
check((await api(hospital, "POST", `/api/requests/${exp.json.id}/donations`, { donorId: String(xm.donorId), units: 1 })).status === 409, `can't record on expired`);

// Cancellation
const can = await api(hospital, "POST", "/api/requests", body({ bloodGroup: "O+", urgency: "URGENT" }));
const km = await col("requestmatches").find({ requestId: oid(can.json.id) }).sort({ score: -1 }).limit(1).next();
await api(await cookieFor(await emailOf(km)), "POST", `/api/matches/${km._id}/respond`, { action: "ACCEPT" });
check((await api(emergency, "POST", `/api/requests/${can.json.id}/cancel`, {})).status === 404, `other institution can't cancel`);
check((await api(hospital, "POST", `/api/requests/${can.json.id}/cancel`, { reason: "x".repeat(201) })).status === 400, `reason > 200 chars rejected`);
const pendingN = await mcount(can.json.id, { status: { $in: ["NOTIFIED", "ACCEPTED"] } });
check((await api(hospital, "POST", `/api/requests/${can.json.id}/cancel`, { reason: "Patient stabilised" })).status === 200 && (await req(can.json.id)).status === "CANCELLED", `creator cancels with reason`);
const told = await col("notifications").countDocuments({ body: /was cancelled: "Patient stabilised"\. No longer needed/ });
check(told === pendingN, `all ${pendingN} pending/accepted donors told, with the reason`);
check((await api(hospital, "POST", `/api/requests/${can.json.id}/cancel`, {})).status === 409, `cancel twice -> 409`);
const rReq = await api(receiver, "POST", "/api/requests", { bloodGroup: "A+", unitsNeeded: 1, urgency: "NORMAL", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalId: String(H._id) });
check((await api(hospital, "POST", `/api/requests/${rReq.json.id}/cancel`, {})).status === 200, `chosen hospital cancels receiver's request`);
check((await col("notifications").countDocuments({ title: /request cancelled$/, userId: (await user("receiver@redlink.test"))._id })) === 1, `receiver told`);
check((await api(donor, "POST", `/api/requests/${far.json.id}/cancel`, {})).status === 403, `donors can't cancel`);

await finish();
