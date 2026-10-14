// Phase 6: admin analytics, verification queue, users (suspend/reactivate + clean-up), flags, all-requests view.
// Run on a freshly seeded database.
import { api, check, col, cookieFor, DAY, finish, login, oid, user } from "./lib.mjs";

const admin = await cookieFor("admin@redlink.test");
const hospital = await cookieFor("hospital@redlink.test");
const receiver = await cookieFor("receiver@redlink.test");
const H = await user("hospital@redlink.test");
const RC = await user("receiver@redlink.test");
const notes = (userId, re) => col("notifications").countDocuments({ userId, $or: [{ title: re }, { body: re }] });
const emailOf = async (id) => (await col("users").findOne({ _id: oid(id) })).email;
const newReq = async (c, o) =>
  (await api(c, "POST", "/api/requests", { unitsNeeded: 2, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalName: "Vidyavihar General Hospital", hospitalAddress: "Station Road", lat: H.lat, lng: H.lng, ...o })).json;

// ---------- Access ----------
for (const p of ["/api/admin/stats", "/api/admin/verifications", "/api/admin/users", "/api/admin/flags", "/api/admin/requests"]) {
  const a = await api(hospital, "GET", p);
  const b = await api(null, "GET", p);
  check(a.status === 403 && b.status === 401, `${p}: hospital 403, logged out 401`);
}

// ---------- Analytics ----------
const stats = (await api(admin, "GET", "/api/admin/stats")).json;
const reqs = await col("bloodrequests").find().toArray();
const ist = new Date(Date.now() + 330 * 60_000);
const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000);
check(stats.totals.donors === (await col("users").countDocuments({ role: "DONOR", status: "ACTIVE" })), `total donors = ${stats.totals.donors}`);
check(stats.totals.openRequests === reqs.filter((r) => ["OPEN", "PARTIALLY_FULFILLED"].includes(r.status)).length, `open requests = ${stats.totals.openRequests}`);
check(stats.totals.fulfilledThisMonth === reqs.filter((r) => r.status === "FULFILLED" && r.fulfilledAt >= monthStart).length, `fulfilled this month = ${stats.totals.fulfilledThisMonth} (IST month)`);
check(stats.totals.fulfilmentRate === 100 && stats.totals.closedRequests === 6, `fulfilment rate 100% of 6 closed`);
// Seeded first responses: 6, 3, 41, 14, 27, 19 min (past) + 8 min (open B+) → 118/7 = 16.9
check(stats.totals.avgFirstAcceptanceMinutes === 16.9, `avg time to first acceptance = ${stats.totals.avgFirstAcceptanceMinutes} min (expected 16.9)`);
check(stats.byBloodGroup.length === 8 && stats.byBloodGroup.reduce((a, b) => a + b.requests, 0) === reqs.length, `requests by blood group: 8 bars summing to ${reqs.length}`);
check(stats.last14Days.length === 14 && stats.last14Days.reduce((a, b) => a + b.created, 0) === reqs.filter((r) => r.createdAt >= new Date(Date.now() - 14 * DAY)).length, `last 14 days: 14 buckets, created counts match`);
check(stats.pending.verifications === 1 && stats.pending.openFlags === 1, `pending: 1 verification, 1 open flag`);
check(stats.totals.availableNow <= stats.totals.donors && stats.totals.availableNow > 0, `available now (${stats.totals.availableNow}) ≤ donors`);

// ---------- Seed: verified donors past cooldown ----------
const verifiedReady = await col("users").countDocuments({ role: "DONOR", "donorProfile.bloodGroupVerified": true, "donorProfile.lastDonationAt": { $lt: new Date(Date.now() - 90 * DAY) } });
check(verifiedReady >= 7, `seed: ${verifiedReady} verified donors past their 90-day cooldown`);
// AB+ patients can receive from every group, so this shows all verified donors who can donate now.
const vs = await api(hospital, "GET", `/api/donors/search?bloodGroup=AB%2B&lat=${H.lat}&lng=${H.lng}&radiusKm=25&verifiedOnly=true`);
check(vs.json.results.length >= 6 && vs.json.results.every((r) => r.verified), `"Verified only" AB+ search within 25 km: ${vs.json.results.length} results, all verified`);
const vsO = await api(hospital, "GET", `/api/donors/search?bloodGroup=O%2B&lat=${H.lat}&lng=${H.lng}&radiusKm=25&verifiedOnly=true`);
check(vsO.json.results.length >= 2 && vsO.json.results.every((r) => ["O+", "O-"].includes(r.bloodGroup)), `"Verified only" O+ search: ${vsO.json.results.length} compatible verified donors`);

// ---------- Verification queue ----------
const ver = (await api(admin, "GET", "/api/admin/verifications")).json;
const nh = ver.pending.find((v) => v.email === "newhospital@redlink.test");
check(ver.pending.length === 1 && nh?.licenseNumber === "MH-HOSP-2026-1150", `queue shows New Life Hospital with its licence`);
check((await api(admin, "POST", `/api/admin/verifications/${nh.id}`, { action: "REJECT" })).status === 409, `reject without a note refused`);
check((await api(admin, "POST", `/api/admin/verifications/${H._id}`, { action: "APPROVE" })).status === 409, `approving an already-active account refused`);
check((await api(admin, "POST", `/api/admin/verifications/abc`, { action: "APPROVE" })).status === 404, `bad id 404`);
const nhCookie = await cookieFor("newhospital@redlink.test");
check((await api(nhCookie, "GET", "/api/requests")).status === 403, `pending hospital blocked before approval`);
const [ap1, ap2] = await Promise.all([
  api(admin, "POST", `/api/admin/verifications/${nh.id}`, { action: "APPROVE" }),
  api(admin, "POST", `/api/admin/verifications/${nh.id}`, { action: "APPROVE" }),
]);
check([ap1.status, ap2.status].sort().join() === "200,409", `two simultaneous approvals: exactly one succeeds (${ap1.status}, ${ap2.status})`);
const nhDoc = await col("users").findOne({ _id: oid(nh.id) });
check(nhDoc.status === "ACTIVE" && nhDoc.institution.verifiedAt && String(nhDoc.institution.verifiedById) === String((await user("admin@redlink.test"))._id), `approved: ACTIVE, verifiedAt + verifiedById set`);
check((await notes(nhDoc._id, /^Organisation verified/)) === 1, `applicant notified of approval`);
check((await api(nhCookie, "GET", "/api/requests")).status === 200, `same session works immediately after approval`);

const signup = await api(null, "POST", "/api/auth/signup", {
  role: "BLOOD_BANK", name: "Test Person", email: "fake.bank@example.com", phone: "9000099001", password: "demo12345",
  orgName: "Fake Blood Bank", licenseNumber: "XX-000",
  location: { lat: 19.07, lng: 72.9, address: "Somewhere Road", city: "Mumbai", pincode: "400077" },
});
const fakeCookie = signup.headers.get("set-cookie")?.split(";")[0];
const fake = await user("fake.bank@example.com");
check(signup.status === 201 && fake.status === "PENDING_VERIFICATION", `new blood bank signup is pending`);
check((await api(admin, "POST", `/api/admin/verifications/${fake._id}`, { action: "REJECT", note: "Licence number XX-000 is not valid." })).status === 200, `reject with note`);
const fakeMe = (await api(fakeCookie, "GET", "/api/auth/me")).json.user;
check(fakeMe.status === "REJECTED" && fakeMe.institution.rejectionNote === "Licence number XX-000 is not valid.", `rejected applicant sees the note`);
check((await api(fakeCookie, "GET", "/api/bloodbank/inventory")).status === 403 && (await notes(fake._id, /not approved/)) === 1, `rejected bank blocked and notified`);
check((await api(admin, "GET", "/api/admin/verifications")).json.rejected.some((v) => v.id === String(fake._id)), `rejected list shows it`);

// ---------- Users: search ----------
const usersQ = async (q) => (await api(admin, "GET", `/api/admin/users?${new URLSearchParams(q)}`)).json;
check((await usersQ({ q: "rahul" })).users.some((u) => u.name === "Rahul Sharma"), `search by name (case-insensitive)`);
check((await usersQ({ q: "Powai Lakeside" })).users.some((u) => u.orgName === "Powai Lakeside Hospital"), `search by organisation`);
const byPhone = await usersQ({ q: H.phone });
check(byPhone.users.length === 1 && byPhone.users[0].id === String(H._id), `search by phone`);
const donorsOnly = await usersQ({ role: "DONOR" });
check(donorsOnly.total === 41 && donorsOnly.users.every((u) => u.role === "DONOR" && u.bloodGroup), `role filter: 41 donors with blood groups`);
check((await usersQ({ status: "PENDING_VERIFICATION" })).total === 0, `status filter`);
check((await usersQ({ q: "(.*" })).total === 0, `regex characters are escaped`);
check((await api(admin, "GET", "/api/admin/users?role=WIZARD")).status === 400, `bad role filter 400`);
const flaggedRow = (await usersQ({ role: "DONOR" })).users.find((u) => u.openFlags > 0);
check(flaggedRow !== undefined, `the seeded flagged donor shows an open-flag count`);

// ---------- Users: guards ----------
const A = await user("admin@redlink.test");
check((await api(admin, "PATCH", `/api/admin/users/${A._id}`, { action: "SUSPEND" })).status === 409, `can't suspend yourself / an admin`);
check((await api(admin, "PATCH", `/api/admin/users/${H._id}`, { action: "REACTIVATE" })).status === 409, `can't reactivate an active account`);
check((await api(hospital, "PATCH", `/api/admin/users/${RC._id}`, { action: "SUSPEND" })).status === 403, `non-admin can't suspend`);

// ---------- Suspend a donor (clean-up) ----------
const openB = await col("bloodrequests").findOne({ bloodGroup: "B+", status: "OPEN", createdById: H._id });
const accepted = await col("requestmatches").findOne({ requestId: openB._id, status: "ACCEPTED" });
const donorId = accepted.donorId;
const donorEmail = await emailOf(donorId);
const donorCookie = await cookieFor(donorEmail);
const cr = await api(receiver, "POST", "/api/contact-requests", { donorId: String(donorId), message: "Please help, my father needs B+ blood." });
check(cr.status === 201, `receiver sends the donor a contact request`);
const donorMatchesBefore = await col("requestmatches").countDocuments({ donorId, status: { $in: ["NOTIFIED", "ACCEPTED"] } });
const [s1, s2] = await Promise.all([
  api(admin, "PATCH", `/api/admin/users/${donorId}`, { action: "SUSPEND" }),
  api(admin, "PATCH", `/api/admin/users/${donorId}`, { action: "SUSPEND" }),
]);
check([s1.status, s2.status].sort().join() === "200,409", `two simultaneous suspensions: exactly one succeeds`);
const sres = s1.status === 200 ? s1.json : s2.json;
check(sres.summary.withdrawnMatches === donorMatchesBefore && sres.summary.declinedContacts === 1, `summary: withdrawn from ${donorMatchesBefore} request(s), 1 contact declined`);
check((await col("requestmatches").findOne({ _id: accepted._id })).status === "DECLINED", `accepted match → DECLINED`);
check((await notes(H._id, /is no longer available on Red Link/)) === 1, `requester told the donor withdrew`);
check((await col("contactrequests").findOne({ _id: oid(cr.json.id) })).status === "DECLINED" && (await notes(RC._id, /^Contact request declined/)) === 1, `pending contact request declined, receiver told politely`);
check((await login(donorEmail)).status === 403, `suspended donor can't log in`);
check((await api(donorCookie, "GET", "/api/donor/feed")).status === 403, `existing session blocked immediately`);
check((await api(donorCookie, "GET", "/api/auth/me")).json.user.status === "SUSPENDED", `/me reports SUSPENDED (status screen)`);
const donorGroup = (await col("users").findOne({ _id: donorId })).donorProfile.bloodGroup;
const searchAfter = await api(hospital, "GET", `/api/donors/search?bloodGroup=${encodeURIComponent(donorGroup)}&lat=${H.lat}&lng=${H.lng}&radiusKm=50`);
check(!searchAfter.json.results.some((r) => r.donorId === String(donorId)), `suspended donor hidden from search`);
const rNew = await newReq(hospital, { bloodGroup: donorGroup, unitsNeeded: 1, urgency: "CRITICAL" === "x" ? "CRITICAL" : "URGENT" });
check(!(await col("requestmatches").findOne({ requestId: oid(rNew.id), donorId })), `suspended donor not matched to new requests`);
await api(hospital, "POST", `/api/requests/${rNew.id}/cancel`, {});
const re = await api(admin, "PATCH", `/api/admin/users/${donorId}`, { action: "REACTIVATE" });
check(re.status === 200 && (await login(donorEmail)).status === 200 && (await notes(donorId, /^Account reactivated/)) === 1, `reactivated: can log in again and is notified`);
check((await col("requestmatches").findOne({ _id: accepted._id })).status === "DECLINED", `reactivation doesn't restore the withdrawn match`);

// ---------- Suspend a receiver (open requests cancelled) ----------
const chembur = await user("chembur.hospital@example.com");
const rr = await api(receiver, "POST", "/api/requests", { bloodGroup: "O+", unitsNeeded: 1, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalId: String(chembur._id) });
check(rr.status === 201 && rr.json.matchedCount > 0, `receiver raises an O+ request at Chembur Care (${rr.json.matchedCount} donors alerted)`);
const rrDonors = (await col("requestmatches").find({ requestId: oid(rr.json.id) }).toArray()).map((m) => m.donorId);
const sr = await api(admin, "PATCH", `/api/admin/users/${RC._id}`, { action: "SUSPEND" });
check(sr.json.summary.cancelledRequests === 1, `suspending the receiver cancels their open request`);
const rrDoc = await col("bloodrequests").findOne({ _id: oid(rr.json.id) });
check(rrDoc.status === "CANCELLED" && (await col("requestmatches").countDocuments({ requestId: rrDoc._id, status: "NO_LONGER_NEEDED" })) === rrDonors.length, `request CANCELLED, all ${rrDonors.length} matches no longer needed`);
check((await col("notifications").countDocuments({ userId: { $in: rrDonors }, body: /Closed by a Red Link admin/ })) === rrDonors.length, `alerted donors told`);
check((await notes(chembur._id, /was cancelled/)) === 1, `chosen hospital told`);
await api(admin, "PATCH", `/api/admin/users/${RC._id}`, { action: "REACTIVATE" });

// ---------- Suspend the chosen hospital (patient requests cancelled) ----------
const rr2 = await api(receiver, "POST", "/api/requests", { bloodGroup: "A+", unitsNeeded: 1, urgency: "NORMAL", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalId: String(chembur._id) });
const sh = await api(admin, "PATCH", `/api/admin/users/${chembur._id}`, { action: "SUSPEND" });
check(sh.json.summary.cancelledRequests === 1 && (await col("bloodrequests").findOne({ _id: oid(rr2.json.id) })).status === "CANCELLED", `suspending a hospital cancels patient requests that chose it`);
check((await notes(RC._id, /chosen hospital is no longer available/)) === 1, `receiver told to choose another hospital`);
check(!(await api(receiver, "GET", "/api/hospitals")).json.hospitals.some((h) => h.id === String(chembur._id)), `suspended hospital no longer offered to receivers`);
await api(admin, "PATCH", `/api/admin/users/${chembur._id}`, { action: "REACTIVATE" });

// ---------- Suspend a blood bank (offers withdrawn, camps hidden) ----------
const bank = await cookieFor("bloodbank@redlink.test");
const BB = await user("bloodbank@redlink.test");
const rb = await newReq(hospital, { bloodGroup: "A+", unitsNeeded: 2 });
const of = await api(bank, "POST", "/api/supply-offers", { requestId: rb.id, bloodGroup: "A+", units: 1 });
check(of.status === 201, `blood bank offers 1 unit`);
const demoDonor = await cookieFor("donor@redlink.test");
const campsBefore = (await api(demoDonor, "GET", "/api/donor/camps")).json.camps.length;
const sb = await api(admin, "PATCH", `/api/admin/users/${BB._id}`, { action: "SUSPEND" });
check(sb.json.summary.withdrawnOffers === 1 && (await col("supplyoffers").findOne({ _id: oid(of.json.id) })).status === "DECLINED", `bank suspended: pending offer withdrawn`);
check((await notes(H._id, /^A supply offer was withdrawn/)) === 1, `requester told the offer was withdrawn`);
check(campsBefore === 2 && (await api(demoDonor, "GET", "/api/donor/camps")).json.camps.length === 0, `its camps are hidden from donors (2 → 0)`);
await api(admin, "PATCH", `/api/admin/users/${BB._id}`, { action: "REACTIVATE" });
check((await api(demoDonor, "GET", "/api/donor/camps")).json.camps.length === 2, `camps reappear after reactivation`);
await api(hospital, "POST", `/api/requests/${rb.id}/cancel`, {});

// ---------- Flags: creating reports ----------
const openA = await col("bloodrequests").findOne({ bloodGroup: "A+", status: "OPEN", hospitalName: "Powai Lakeside Hospital" });
const DEMO = await user("donor@redlink.test");
const powaiMatch = await col("requestmatches").findOne({ requestId: openA._id, status: "NOTIFIED", donorId: { $ne: DEMO._id } });
// A request the demo donor was NOT alerted for.
const demoMatched = (await col("requestmatches").find({ donorId: DEMO._id }).toArray()).map((m) => String(m.requestId));
const notMine = (await col("bloodrequests").find().toArray()).find((r) => !demoMatched.includes(String(r._id)));
const matchedDonor = await cookieFor(await emailOf(powaiMatch.donorId));
const admins = [A._id];
const before = await col("flags").countDocuments();
const f1 = await api(matchedDonor, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openA._id), reason: "The phone number on this request is switched off." });
check(f1.status === 201, `matched donor reports the request`);
const f1doc = await col("flags").findOne({ _id: oid(f1.json.id) });
check(String(f1doc.targetUserId) === String(openA.createdById) && String(f1doc.requestId) === String(openA._id), `report targets the request's creator`);
check((await api(matchedDonor, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openA._id), reason: "Same thing again, still switched off." })).status === 409, `duplicate open report refused`);
check((await api(matchedDonor, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openA._id), reason: "short" })).status === 400, `reason under 10 characters refused`);
check((await api(demoDonor, "POST", "/api/flags", { kind: "REQUEST", requestId: String(notMine._id), reason: "I was never alerted for this one." })).status === 404, `donor can't report a request they weren't alerted for`);
check((await api(hospital, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openB._id), reason: "Reporting my own request here." })).status === 400, `can't report your own request`);
check((await api(admin, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openA._id), reason: "Admins don't report things." })).status === 403, `admins can't file reports`);
check((await notes(A._id, /^New report to review/)) === 1, `admin notified of the new report`);

const notifiedB = await col("requestmatches").findOne({ requestId: openB._id, status: "NOTIFIED" });
check((await api(hospital, "POST", "/api/flags", { kind: "MATCH", matchId: String(notifiedB._id), reason: "Never answered our call at all." })).status === 409, `can't report a donor who only got notified`);
// Get an accepted donor on openB, then report them as the hospital.
const nb = await col("requestmatches").find({ requestId: openB._id, status: "NOTIFIED" }).sort({ score: -1 }).limit(2).toArray();
const accDonor = nb.find((m) => true);
const accEmail = await emailOf(accDonor.donorId);
if (accEmail === "donor@redlink.test") nb.shift();
const target = nb[0];
await api(await cookieFor(await emailOf(target.donorId)), "POST", `/api/matches/${target._id}/respond`, { action: "ACCEPT" });
const f2 = await api(hospital, "POST", "/api/flags", { kind: "MATCH", matchId: String(target._id), reason: "Accepted but did not arrive at the hospital." });
check(f2.status === 201 && String((await col("flags").findOne({ _id: oid(f2.json.id) })).targetUserId) === String(target.donorId), `hospital reports an accepted donor`);
check((await api(await cookieFor("powai.hospital@example.com"), "POST", "/api/flags", { kind: "MATCH", matchId: String(target._id), reason: "Not my request but reporting." })).status === 404, `another hospital can't report donors on someone else's request`);

const cr2 = await api(receiver, "POST", "/api/contact-requests", { donorId: String(powaiMatch.donorId), message: "Hello, can you help with A+ blood?" });
const f3 = await api(matchedDonor, "POST", "/api/flags", { kind: "CONTACT", contactRequestId: cr2.json.id, reason: "This person keeps sending me rude messages." });
check(f3.status === 201 && String((await col("flags").findOne({ _id: oid(f3.json.id) })).targetUserId) === String(RC._id), `donor reports the receiver from a contact request`);
check((await api(demoDonor, "POST", "/api/flags", { kind: "CONTACT", contactRequestId: cr2.json.id, reason: "Not my contact request at all." })).status === 404, `outsider can't report someone else's contact request`);
const f4 = await api(bank, "POST", "/api/flags", { kind: "REQUEST", requestId: String(openA._id), reason: "Suspicious request, hospital denies it." });
check(f4.status === 201, `blood bank can report a nearby request`);
check((await col("flags").countDocuments()) === before + 4, `4 reports stored`);

// ---------- Flags: review ----------
const open = (await api(admin, "GET", "/api/admin/flags?status=OPEN")).json.flags;
check(open.length === 5 && open.every((f) => f.status === "OPEN" && f.reporter.name), `admin sees 5 open flags with reporter details`);
const seedFlag = open.find((f) => f.reason.startsWith("Accepted two requests"));
check(seedFlag.target?.role === "DONOR" && seedFlag.reporter.name === "Vidyavihar General Hospital", `seed flag: hospital → donor`);
const f1item = open.find((f) => f.id === f1.json.id);
check(f1item.request?.id === String(openA._id) && f1item.target?.name === "Powai Lakeside Hospital", `request flag shows request + target org`);

const d1 = await api(admin, "PATCH", "/api/admin/flags", { flagId: f4.json.id, action: "DISMISS" });
check(d1.status === 200 && (await col("flags").findOne({ _id: oid(f4.json.id) })).status === "DISMISSED", `dismiss`);
check((await notes(BB._id, /no action was needed/)) === 1, `reporter told it was dismissed`);
check((await api(admin, "PATCH", "/api/admin/flags", { flagId: f4.json.id, action: "RESOLVE" })).status === 409, `can't review twice`);
const r1 = await api(admin, "PATCH", "/api/admin/flags", { flagId: f1.json.id, action: "RESOLVE", note: "We spoke to the hospital; number updated." });
const r1doc = await col("flags").findOne({ _id: oid(f1.json.id) });
check(r1.status === 200 && r1doc.status === "RESOLVED" && r1doc.resolutionNote === "We spoke to the hospital; number updated." && r1doc.resolvedAt && String(r1doc.resolvedById) === String(A._id), `resolve with note: status, note, time and admin saved`);
check((await notes(powaiMatch.donorId, /number updated/)) === 1, `reporter gets the admin note`);
const seedTarget = seedFlag.target.id;
const sus = await api(admin, "PATCH", "/api/admin/flags", { flagId: seedFlag.id, action: "SUSPEND_AND_RESOLVE", note: "Repeated no-shows." });
check(sus.status === 200 && (await col("users").findOne({ _id: oid(seedTarget) })).status === "SUSPENDED" && (await col("flags").findOne({ _id: oid(seedFlag.id) })).status === "RESOLVED", `suspend & resolve: donor suspended, flag resolved`);
check((await notes(H._id, /suspended the account/)) === 1, `reporter told the account was suspended`);
// Suspend & resolve on an already-suspended target fails cleanly and leaves the flag open.
await api(admin, "PATCH", `/api/admin/users/${RC._id}`, { action: "SUSPEND" });
const bad = await api(admin, "PATCH", "/api/admin/flags", { flagId: f3.json.id, action: "SUSPEND_AND_RESOLVE" });
check(bad.status === 409 && (await col("flags").findOne({ _id: oid(f3.json.id) })).status === "OPEN", `suspend & resolve on an already-suspended user: refused, flag stays open (transaction rolled back)`);
await api(admin, "PATCH", `/api/admin/users/${RC._id}`, { action: "REACTIVATE" });
check((await api(admin, "GET", "/api/admin/flags?status=RESOLVED")).json.flags.length === 2 && (await api(admin, "GET", "/api/admin/flags")).json.flags.length === 5, `status tabs: 2 resolved, 5 total`);
check((await api(admin, "PATCH", "/api/admin/flags", { flagId: "nope", action: "RESOLVE" })).status === 404, `unknown flag 404`);

// ---------- All requests (admin, read-only) ----------
const all = (await api(admin, "GET", "/api/admin/requests")).json.requests;
check(all.length === (await col("bloodrequests").countDocuments()) && all.every((r) => r.createdByName && r.createdByRole), `all requests listed with creator`);
const active = (await api(admin, "GET", "/api/admin/requests?status=ACTIVE")).json.requests;
check(active.every((r) => r.isOpen), `ACTIVE filter (${active.length})`);
const view = (await api(admin, "GET", `/api/requests/${openB._id}`)).json;
const accRows = view.matches.filter((m) => m.status === "ACCEPTED");
check(view.viewer.isAdmin && !view.viewer.canRecord && !view.viewer.canCancel && !view.viewer.canExpand && !view.viewer.canRespondOffers && !view.viewer.canReportDonors, `admin view is read-only`);
check(accRows.length > 0 && accRows.every((m) => /^\d{10}$/.test(m.phone)), `admin sees phones of donors who accepted`);
check(view.matches.filter((m) => m.status === "NOTIFIED").every((m) => m.phone === null && /^\S+ \S\.$/.test(m.displayName)), `notified donors still masked for admin`);
check(view.admin.createdBy.name === "Vidyavihar General Hospital" && view.admin.createdBy.email === "hospital@redlink.test", `admin sees who raised it`);
check((await api(admin, "POST", `/api/requests/${openB._id}/cancel`, {})).status === 403, `admin can't cancel`);
check((await api(hospital, "GET", `/api/requests/${openA._id}`)).status === 404, `other hospitals still can't open the request`);
const hv = (await api(hospital, "GET", `/api/requests/${openB._id}`)).json;
check(hv.admin === null && hv.viewer.canReportDonors && !hv.viewer.isAdmin, `requester view: no admin block, can report donors`);
const chemburView = (await api(await cookieFor("hospital@redlink.test"), "GET", `/api/requests/${(await col("bloodrequests").findOne({ createdById: RC._id, recordingHospitalId: H._id }))._id}`)).json;
check(chemburView.viewer.canReportRequest === true, `chosen hospital can report a receiver's request`);

// Stats reflect the changes.
const s2b = (await api(admin, "GET", "/api/admin/stats")).json;
check(s2b.pending.verifications === 0 && s2b.pending.openFlags === 2, `stats now: 0 pending verifications, 2 open flags`);
check(s2b.totals.closedRequests > 6 && s2b.totals.fulfilmentRate < 100, `cancelled requests lower the fulfilment rate (${s2b.totals.fulfilmentRate}%)`);

await finish();
