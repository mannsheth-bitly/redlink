// Phase 3: masked search, contact requests (phone never sent before accept), receiver-raised requests.
import { api, check, col, cookieFor, DAY, finish, hav, oid, user } from "./lib.mjs";

const donors = await col("users").find({ role: "DONOR" }).toArray();
const phones = donors.map((d) => d.phone);
const leaks = (t) => phones.filter((p) => t.includes(p));
const seen = [];
const receiver = await cookieFor("receiver@redlink.test");
const R0 = await user("receiver@redlink.test");
const rget = async (p) => { const r = await api(receiver, "GET", p); seen.push(r); return r; };
const byId = new Map(donors.map((d) => [String(d._id), d]));
const now = Date.now();
const eligibleNow = (d) => {
  const p = d.donorProfile;
  const age = (now - new Date(p.dateOfBirth).getTime()) / (365.25 * DAY);
  return d.status === "ACTIVE" && p.isAvailable && age >= 18 && age < 66 && p.weightKg >= 50 && (!p.lastDonationAt || now - new Date(p.lastDonationAt).getTime() >= 90 * DAY);
};

// 1. Search
const q = `bloodGroup=A%2B&lat=${R0.lat}&lng=${R0.lng}&radiusKm=25&verifiedOnly=false`;
const s = await rget(`/api/donors/search?${q}`);
const res = s.json.results;
check(s.status === 200 && res.length > 0, `receiver search A+ within 25 km -> ${res.length}`);
check(leaks(s.text).length === 0 && !donors.some((d) => s.text.includes(d.name)) && !donors.some((d) => s.text.includes(String(d.lat))), `no phones, full names or exact coordinates`);
const rd = res.map((r) => byId.get(r.donorId));
check(rd.every((d) => ["O-", "O+", "A-", "A+"].includes(d.donorProfile.bloodGroup) && eligibleNow(d) && hav(R0, d) <= 25), `only compatible, eligible-now donors within 25 km`);
const expected = donors.filter((d) => ["O-", "O+", "A-", "A+"].includes(d.donorProfile.bloodGroup) && eligibleNow(d) && hav(R0, d) <= 25).length;
check(res.length === Math.min(expected, 50), `none missing (${res.length}/${expected})`);
check(res.every((r) => hav(byId.get(r.donorId), r.approxLocation) < 0.8 && r.approxLocation.lat !== byId.get(r.donorId).lat), `map positions snapped to ~1 km`);
check(res.every((r) => /^\S+( \S\.)?$/.test(r.displayName)), `names masked "First L."`);
const v = await rget(`/api/donors/search?bloodGroup=AB%2B&lat=19.07&lng=72.9&radiusKm=50&verifiedOnly=true`);
const vAll = await rget(`/api/donors/search?bloodGroup=AB%2B&lat=19.07&lng=72.9&radiusKm=50&verifiedOnly=false`);
check(v.json.results.length >= 1 && v.json.results.every((r) => r.verified) && vAll.json.results.length > v.json.results.length, `verified-only filter (${vAll.json.results.length} -> ${v.json.results.length})`);
check((await rget(`/api/donors/search?${q.replace("radiusKm=25", "radiusKm=30")}`)).status === 400, `radius must be 5/10/25/50`);

// 2. Contact requests
const [first, second] = res;
const fd = byId.get(first.donorId);
const sent = await api(receiver, "POST", "/api/contact-requests", { donorId: first.donorId, message: "My father needs A+ blood tomorrow." });
seen.push(sent);
check(sent.status === 201, `contact request sent`);
check((await api(receiver, "POST", "/api/contact-requests", { donorId: first.donorId, message: "Second try please" })).status === 409, `duplicate pending -> 409`);
const pend = await rget("/api/contact-requests");
check(pend.json.contactRequests[0].otherPhone === null, `pending: no phone for receiver`);
check((await rget(`/api/donors/search?${q}`)).json.results.find((r) => r.donorId === first.donorId).contactStatus === "PENDING", `search shows "Request sent"`);
const dC = await cookieFor(fd.email);
const dl = await api(dC, "GET", "/api/contact-requests");
check(dl.json.contactRequests[0].otherPhone === null && !dl.text.includes(R0.phone), `pending: donor doesn't see receiver's phone`);
check((await col("notifications").countDocuments({ userId: fd._id, type: "CONTACT_REQUEST" })) === 1, `donor notified`);
check(seen.every((x) => leaks(x.text).length === 0), `NO donor phone in ANY of ${seen.length} receiver responses before accept`);
check((await api(dC, "POST", `/api/contact-requests/${dl.json.contactRequests[0].id}/respond`, { action: "ACCEPT" })).status === 200, `donor accepts`);
const after = await api(receiver, "GET", "/api/contact-requests");
check(after.json.contactRequests[0].otherPhone === fd.phone && after.json.contactRequests[0].otherName === fd.name, `receiver now sees donor name + phone`);
check((await api(dC, "GET", "/api/contact-requests")).json.contactRequests[0].otherPhone === R0.phone, `donor now sees receiver phone`);
check((await api(dC, "POST", `/api/contact-requests/${dl.json.contactRequests[0].id}/respond`, { action: "DECLINE" })).status === 409, `can't change answered request`);
const sd = byId.get(second.donorId);
await api(receiver, "POST", "/api/contact-requests", { donorId: second.donorId, message: "Could you help with A+?" });
const sC = await cookieFor(sd.email);
const sl = await api(sC, "GET", "/api/contact-requests");
await api(sC, "POST", `/api/contact-requests/${sl.json.contactRequests[0].id}/respond`, { action: "DECLINE" });
const ad = await api(receiver, "GET", "/api/contact-requests");
check(ad.json.contactRequests.find((c) => c.status === "DECLINED")?.otherPhone === null && !ad.text.includes(sd.phone), `declined: phone never shared`);
const polite = await col("notifications").findOne({ userId: R0._id, title: "Contact request declined" });
check(polite && /thank you for understanding/i.test(polite.body), `receiver told politely`);

// 3. Permissions
check((await api(dC, "GET", `/api/donors/search?${q}`)).status === 403, `donors can't search`);
const hospital = await cookieFor("hospital@redlink.test");
const hs = await api(hospital, "GET", `/api/donors/search?${q}`);
check(hs.status === 200 && leaks(hs.text).length === 0, `hospital search allowed, masked`);
check((await api(hospital, "POST", "/api/contact-requests", { donorId: first.donorId, message: "hello there" })).status === 403, `hospital can't send contact requests`);
check((await api(await cookieFor("emergency@redlink.test"), "GET", `/api/donors/search?${q}`)).status === 200, `emergency search allowed`);

// 4. Receiver raises a request at a verified hospital
const H = await user("hospital@redlink.test");
const pendingH = await user("newhospital@redlink.test");
const hosp = await rget("/api/hospitals");
check(hosp.json.hospitals.length === 3 && !hosp.json.hospitals.some((h) => h.id === String(pendingH._id)), `hospital list: 3 verified, pending one excluded`);
const body = { bloodGroup: "B+", unitsNeeded: 1, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), patientNote: "Phase 3 test" };
check((await api(receiver, "POST", "/api/requests", { ...body, hospitalId: String(pendingH._id) })).status === 400, `unverified hospital rejected`);
check((await api(receiver, "POST", "/api/requests", { ...body, urgency: "CRITICAL", hospitalId: String(H._id) })).status === 400, `receiver can't raise CRITICAL`);
const raised = await api(receiver, "POST", "/api/requests", { ...body, hospitalId: String(H._id) });
check(raised.status === 201 && raised.json.matchedCount > 0 && raised.json.path.startsWith("/receiver/requests/"), `receiver raises URGENT B+ -> matched ${raised.json?.matchedCount}`);
const rid = raised.json.id;
const rr = await col("bloodrequests").findOne({ _id: oid(rid) });
check(String(rr.recordingHospitalId) === String(H._id) && rr.hospitalName === "Vidyavihar General Hospital" && rr.radiusKm === 25, `linked to chosen hospital`);
check((await col("notifications").countDocuments({ userId: H._id, title: /^Patient request at your hospital/ })) === 1, `chosen hospital notified`);
check((await api(hospital, "GET", "/api/requests")).json.patientRequests.some((r) => r.id === rid), `hospital's dashboard lists the patient request`);
const rv = await rget(`/api/requests/${rid}`);
check(rv.json.viewer.canRecord === false && leaks(rv.text).length === 0, `receiver view: no phones before accept, can't record`);
const top = await col("requestmatches").find({ requestId: oid(rid) }).sort({ score: -1 }).limit(1).next();
const topDonor = byId.get(String(top.donorId));
const tC = await cookieFor(topDonor.email);
check((await api(tC, "GET", `/api/requests/${rid}`)).json.request.badge === "INDIVIDUAL", `donor sees "Individual request" badge`);
await api(tC, "POST", `/api/matches/${top._id}/respond`, { action: "ACCEPT" });
check((await api(receiver, "GET", `/api/requests/${rid}`)).json.matches.find((m) => m.status === "ACCEPTED")?.phone === topDonor.phone, `receiver sees accepted donor's phone`);
check((await api(hospital, "GET", `/api/requests/${rid}`)).json.viewer.canRecord === true, `chosen hospital can record`);
check((await api(receiver, "POST", `/api/requests/${rid}/donations`, { donorId: String(top.donorId), units: 1 })).status === 403, `receiver can't record`);
check((await api(await cookieFor("powai.hospital@example.com"), "POST", `/api/requests/${rid}/donations`, { donorId: String(top.donorId), units: 1 })).status === 404, `other hospital can't record`);
const rec = await api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(top.donorId), units: 1 });
check(rec.status === 201 && rec.json.status === "FULFILLED" && (await col("users").findOne({ _id: top.donorId })).donorProfile.bloodGroupVerified, `chosen hospital records -> FULFILLED, donor verified`);
check((await col("notifications").countDocuments({ userId: R0._id, title: /request is fulfilled$/ })) === 1, `receiver notified`);

await finish();
