// Phase 2: request broadcast, matching, accept/decline/withdraw, record donation, fulfilment, profile.
import { api, check, col, cookieFor, DAY, finish, hav, oid, user } from "./lib.mjs";

const hospital = await cookieFor("hospital@redlink.test");
const H = await user("hospital@redlink.test");

// 1. Hospital creates O+ URGENT
const created = await api(hospital, "POST", "/api/requests", {
  bloodGroup: "O+", unitsNeeded: 3, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(),
  patientNote: "Phase 2 test", hospitalName: "Vidyavihar General Hospital", hospitalAddress: "Station Road, Vidyavihar East, Mumbai 400077",
  lat: H.lat, lng: H.lng,
});
check(created.status === 201 && created.json.matchedCount > 0 && created.json.path === `/hospital/requests/${created.json.id}`, `hospital creates O+ URGENT -> matched ${created.json?.matchedCount}`);
const rid = created.json.id;

// 2. Exactly the right donors matched
const matched = new Set((await col("requestmatches").find({ requestId: oid(rid) }).toArray()).map((m) => String(m.donorId)));
const donors = await col("users").find({ role: "DONOR" }).toArray();
const now = Date.now();
let wrongIn = 0, wrongOut = 0;
for (const d of donors) {
  const p = d.donorProfile;
  const age = (now - new Date(p.dateOfBirth).getTime()) / (365.25 * DAY);
  const ok = ["O+", "O-"].includes(p.bloodGroup) && d.status === "ACTIVE" && p.isAvailable && age >= 18 && age < 66 && p.weightKg >= 50 &&
    (!p.lastDonationAt || now - new Date(p.lastDonationAt).getTime() >= 90 * DAY) && hav(H, d) <= 25;
  if (matched.has(String(d._id)) && !ok) wrongIn++;
  if (!matched.has(String(d._id)) && ok) wrongOut++;
}
check(wrongIn === 0 && wrongOut === 0, `only & all compatible eligible donors within 25 km matched (${wrongIn} wrong, ${wrongOut} missed)`);

// 3. Feeds
const donorDoc = await user("donor@redlink.test");
const donor = await cookieFor("donor@redlink.test");
const feed = await api(donor, "GET", "/api/donor/feed");
check(feed.json.feed.some((f) => f.requestId === rid), `O− demo donor sees it in their feed`);
const bPos = donors.find((d) => d.donorProfile.bloodGroup === "B+" && d.email.endsWith("@example.com"));
const bCookie = await cookieFor(bPos.email);
check(!(await api(bCookie, "GET", "/api/donor/feed")).json.feed.some((f) => f.requestId === rid), `B+ donor does NOT see the O+ request`);
check((await api(bCookie, "GET", `/api/requests/${rid}`)).status === 404, `unmatched donor opening it -> 404`);
check((await api(donor, "GET", "/api/notifications")).json.urgent.some((n) => n.link === `/donor/requests/${rid}`), `donor has an unread URGENT alert`);

// 4. Privacy before accept
const before = await api(hospital, "GET", `/api/requests/${rid}`);
check(before.json.matches.every((m) => m.phone === null) && !before.text.includes(donorDoc.phone) && !before.text.includes(donorDoc.name), `no phones / full names before accept`);
check(!/"lat"|"lng"/.test(before.text), `no coordinates in hospital response`);
const preDetail = await api(donor, "GET", `/api/requests/${rid}`);
check(preDetail.json.request.hospitalAddress === null, `donor doesn't get the address before accepting`);

// 5. Accept
const myMatch = await col("requestmatches").findOne({ requestId: oid(rid), donorId: donorDoc._id });
const acc = await api(donor, "POST", `/api/matches/${myMatch._id}/respond`, { action: "ACCEPT" });
check(acc.status === 200 && acc.json.status === "ACCEPTED", `donor accepts`);
check((await api(donor, "POST", `/api/matches/${myMatch._id}/respond`, { action: "ACCEPT" })).status === 409, `accepting twice -> 409`);
const after = await api(hospital, "GET", `/api/requests/${rid}`);
const row = after.json.matches.find((m) => m.donorId === String(donorDoc._id));
check(row?.phone === donorDoc.phone && row.displayName === donorDoc.name && after.json.matches[0].status === "ACCEPTED", `hospital sees accepted donor's name + phone, ranked first`);
check((await api(hospital, "GET", "/api/notifications")).json.notifications.some((n) => n.title.includes("accepted")), `hospital notified of acceptance`);
check((await api(donor, "GET", `/api/requests/${rid}`)).json.request.hospitalAddress.includes("Station Road"), `donor now sees the hospital address`);

// 6. Record donation
const rec = await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(donorDoc._id), units: 1 });
check(rec.status === 201 && rec.json.status === "PARTIALLY_FULFILLED" && rec.json.unitsFulfilled === 1, `record donation -> 1/3`);
const prof = (await user("donor@redlink.test")).donorProfile;
check(prof.bloodGroupVerified === true && Date.now() - new Date(prof.lastDonationAt).getTime() < 300_000, `donor verified, cooldown started`);
const hist = await api(donor, "GET", "/api/donor/history");
check(hist.json.history.length === 1 && hist.json.livesImpacted === 3, `history shows it (lives impacted 3)`);
check(!(await api(donor, "GET", "/api/donor/feed")).json.feed.some((f) => f.requestId === rid), `request gone from feed`);
check((await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(donorDoc._id), units: 1 })).status === 409, `same donor twice -> 409`);

// 7. Withdraw
const others = await col("requestmatches").find({ requestId: oid(rid), status: "NOTIFIED" }).sort({ score: -1 }).toArray();
const emailOf = async (m) => (await col("users").findOne({ _id: m.donorId })).email;
const [a, b, c] = others;
const aC = await cookieFor(await emailOf(a));
await api(aC, "POST", `/api/matches/${a._id}/respond`, { action: "ACCEPT" });
const w = await api(aC, "POST", `/api/matches/${a._id}/respond`, { action: "DECLINE" });
check(w.status === 200 && w.json.status === "DECLINED", `donor can withdraw after accepting`);
check((await api(hospital, "GET", "/api/notifications")).json.notifications.some((n) => n.title.includes("withdrew")), `hospital told about withdrawal`);
check((await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(a.donorId), units: 1 })).status === 409, `can't record withdrawn donor`);

// 8. Fulfil with 2 units
const bC2 = await cookieFor(await emailOf(b));
await api(bC2, "POST", `/api/matches/${b._id}/respond`, { action: "ACCEPT" });
check((await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(b.donorId), units: 3 })).status === 400, `3 units per donor rejected`);
const rec2 = await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(b.donorId), units: 2 });
check(rec2.status === 201 && rec2.json.status === "FULFILLED", `2 units fulfils the request`);
check((await col("requestmatches").countDocuments({ requestId: oid(rid), status: { $in: ["NOTIFIED", "ACCEPTED"] } })) === 0, `no pending matches left`);
check((await col("notifications").countDocuments({ userId: c.donorId, body: /No longer needed/ })) === 1, `waiting donor told "No longer needed"`);
check((await api(await cookieFor(await emailOf(c)), "POST", `/api/matches/${c._id}/respond`, { action: "ACCEPT" })).status === 409, `accepting a fulfilled request -> 409`);

// 9. Permissions
check((await api(donor, "POST", "/api/requests", { bloodGroup: "O+" })).status === 403, `donor can't create requests`);
const body = (o) => ({ bloodGroup: "A+", unitsNeeded: 1, urgency: "NORMAL", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalName: "X Hospital", hospitalAddress: "Somewhere", lat: 19.07, lng: 72.9, ...o });
const crit = await api(hospital, "POST", "/api/requests", body({ urgency: "CRITICAL" }));
check(crit.status === 403 && /CRITICAL/.test(crit.json.error), `hospital can't create CRITICAL ("${crit.json?.error}")`);
const past = await api(hospital, "POST", "/api/requests", body({ neededBy: new Date(Date.now() - 1000).toISOString() }));
check(past.status === 400 && /future/.test(past.json.error), `past needed-by rejected ("${past.json?.error}")`);
const emergency = await cookieFor("emergency@redlink.test");
check((await api(emergency, "GET", `/api/requests/${rid}`)).status === 404, `other institution can't view it`);
check((await api(emergency, "POST", `/api/requests/${rid}/donations`, { donorId: String(b.donorId), units: 1 })).status === 404, `other institution can't record on it`);
const E = await user("emergency@redlink.test");
const em = await api(emergency, "POST", "/api/requests", body({ bloodGroup: "B+", urgency: "CRITICAL", lat: E.lat, lng: E.lng, hospitalName: "Vidyavihar General Hospital" }));
const emReq = await col("bloodrequests").findOne({ _id: oid(em.json.id) });
check(em.status === 201 && emReq.radiusKm === 50, `emergency CRITICAL -> 50 km (${em.json.matchedCount} matched)`);
const emM = await col("requestmatches").find({ requestId: emReq._id }).sort({ score: -1 }).limit(1).next();
await api(await cookieFor(await emailOf(emM)), "POST", `/api/matches/${emM._id}/respond`, { action: "ACCEPT" });
check((await api(emergency, "POST", `/api/requests/${em.json.id}/donations`, { donorId: String(emM.donorId), units: 1 })).json.status === "FULFILLED", `emergency records its own donation`);

// 10. Notifications mark read (incl. junk ids)
check((await api(donor, "POST", "/api/notifications/read", { ids: ["not-an-id"] })).status === 200, `junk notification ids ignored (no crash)`);
await api(donor, "POST", "/api/notifications/read", { ids: "all" });
const n = await api(donor, "GET", "/api/notifications");
check(n.json.unreadCount === 0 && n.json.urgent.length === 0, `mark all read clears unread + urgent`);

// 11. Profile + availability
const base = { name: "Aarav Mehta", email: "donor@redlink.test", phone: "9000000011", location: { lat: 19.08, lng: 72.898, address: "Rajawadi", city: "Mumbai", pincode: "400077" }, dateOfBirth: "2000-03-14", gender: "MALE", weightKg: 73, lastDonationAt: null };
check((await api(donor, "PATCH", "/api/donor/profile", { ...base, bloodGroup: "O-" })).status === 200 && (await user("donor@redlink.test")).donorProfile.bloodGroupVerified === true, `profile edit keeps Verified when group unchanged`);
check((await api(donor, "PATCH", "/api/donor/profile", { ...base, bloodGroup: "AB+" })).status === 200 && (await user("donor@redlink.test")).donorProfile.bloodGroupVerified === false, `changing group removes Verified`);
check((await api(donor, "PATCH", "/api/donor/profile", { ...base, bloodGroup: "AB+", email: "hospital@redlink.test" })).status === 409, `can't take another email`);
check((await api(donor, "PATCH", "/api/donor/availability", { isAvailable: false })).status === 200 && (await user("donor@redlink.test")).donorProfile.isAvailable === false, `availability toggle saves`);

await finish();
