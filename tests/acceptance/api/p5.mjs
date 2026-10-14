// Phase 5: inventory, supply offers, walk-ins, camps.
import { api, check, col, cookieFor, DAY, finish, oid, user } from "./lib.mjs";

const bank = await cookieFor("bloodbank@redlink.test");
const hospital = await cookieFor("hospital@redlink.test");
const receiver = await cookieFor("receiver@redlink.test");
const B = await user("bloodbank@redlink.test");
const H = await user("hospital@redlink.test");
const stock = async (g) => (await col("inventoryitems").findOne({ bloodBankId: B._id, bloodGroup: g }))?.units ?? 0;
const req = (id) => col("bloodrequests").findOne({ _id: oid(id) });
const offer = (id) => col("supplyoffers").findOne({ _id: oid(id) });
const notes = (userId, re) => col("notifications").countDocuments({ userId, $or: [{ title: re }, { body: re }] });
const emailOf = async (m) => (await col("users").findOne({ _id: m.donorId })).email;
const newReq = async (c, o) => (await api(c, "POST", "/api/requests", { unitsNeeded: 2, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalName: "Vidyavihar General Hospital", hospitalAddress: "Station Road", lat: H.lat, lng: H.lng, ...o })).json;
const acceptAndRecord = async (rid, units = 1) => {
  const m = await col("requestmatches").find({ requestId: oid(rid), status: "NOTIFIED" }).sort({ score: -1 }).limit(1).next();
  await api(await cookieFor(await emailOf(m)), "POST", `/api/matches/${m._id}/respond`, { action: "ACCEPT" });
  return api(hospital, "POST", `/api/requests/${rid}/donations`, { donorId: String(m.donorId), units });
};

// Inventory
const inv = await api(bank, "GET", "/api/bloodbank/inventory");
check(inv.json.inventory.map((i) => i.bloodGroup).join() === "O-,O+,A-,A+,B-,B+,AB-,AB+", `8 tiles in order`);
check(inv.json.inventory.filter((i) => i.low).map((i) => i.bloodGroup).join() === "O-", `only O− (2) flagged low`);
await api(bank, "PATCH", "/api/bloodbank/inventory", { bloodGroup: "AB-", delta: 5 });
check((await stock("AB-")) === 13, `+5 -> 13`);
await api(bank, "PATCH", "/api/bloodbank/inventory", { bloodGroup: "AB-", delta: -100 });
check((await stock("AB-")) === 0, `never below 0`);
await api(bank, "PATCH", "/api/bloodbank/inventory", { bloodGroup: "AB-", units: 8 });
check((await stock("AB-")) === 8, `set exact units`);
check((await api(bank, "PATCH", "/api/bloodbank/inventory", { bloodGroup: "AB-" })).status === 400, `empty change rejected`);
check((await api(hospital, "GET", "/api/bloodbank/inventory")).status === 403, `non-bank 403`);

// Open requests
const open = await api(bank, "GET", "/api/bloodbank/open-requests");
const COMPAT = { "O-": ["O-"], "O+": ["O-", "O+"], "A-": ["O-", "A-"], "A+": ["O-", "O+", "A-", "A+"], "B-": ["O-", "B-"], "B+": ["O-", "O+", "B-", "B+"], "AB-": ["O-", "A-", "B-", "AB-"], "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] };
check(open.json.requests.length >= 2 && open.json.requests.every((r) => r.options.every((o) => COMPAT[r.bloodGroup].includes(o.bloodGroup))), `bank sees open requests with compatible options only (${open.json.requests.length})`);

// Offers
const r1 = await newReq(hospital, { bloodGroup: "O+", unitsNeeded: 3 });
check((await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "A+", units: 1 })).status === 400, `incompatible rejected`);
check((await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O+", units: 4 })).status === 400, `more than needed rejected`);
check((await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O-", units: 3 })).status === 400, `more than in stock rejected`);
const o1 = await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O+", units: 2 });
check(o1.status === 201, `valid offer 2 × O+`);
check((await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O-", units: 1 })).status === 409, `second pending offer rejected`);
check((await stock("O+")) === 24 && (await notes(H._id, /offered 2 units/)) === 1, `stock unchanged while pending; requester notified`);
check((await api(hospital, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O+", units: 1 })).status === 403, `hospitals can't offer`);
check((await api(await cookieFor("powai.hospital@example.com"), "POST", `/api/supply-offers/${o1.json.id}/respond`, { action: "ACCEPT" })).status === 404, `other hospital can't accept`);
const acc = await api(hospital, "POST", `/api/supply-offers/${o1.json.id}/respond`, { action: "ACCEPT" });
check(acc.json.unitsApplied === 2 && (await stock("O+")) === 22 && (await req(r1.id)).unitsFulfilled === 2, `accept: stock 24 -> 22, request 2/3`);
check((await notes(B._id, /^Supply offer accepted/)) === 1, `bank notified`);
check((await api(hospital, "POST", `/api/supply-offers/${o1.json.id}/respond`, { action: "ACCEPT" })).status === 409, `can't accept twice`);
check((await api(hospital, "GET", `/api/requests/${r1.id}`)).json.supplyOffers[0].status === "ACCEPTED", `offer shown on request`);
const o2 = await api(bank, "POST", "/api/supply-offers", { requestId: r1.id, bloodGroup: "O-", units: 1 });
const done = await acceptAndRecord(r1.id);
check(done.json.status === "FULFILLED" && (await offer(o2.json.id)).status === "DECLINED" && (await stock("O-")) === 2, `donation fulfils -> pending offer auto-declined, O− untouched`);

// Stock dropped before accept
const r2 = await newReq(hospital, { bloodGroup: "A+" });
const o3 = await api(bank, "POST", "/api/supply-offers", { requestId: r2.id, bloodGroup: "O-", units: 2 });
await api(bank, "PATCH", "/api/bloodbank/inventory", { bloodGroup: "O-", delta: -1 });
const short = await api(hospital, "POST", `/api/supply-offers/${o3.json.id}/respond`, { action: "ACCEPT" });
check(short.status === 409 && /no longer has/.test(short.json.error), `stock dropped -> clean 409 ("${short.json?.error}")`);
check((await offer(o3.json.id)).status === "PENDING" && (await stock("O-")) === 1 && (await req(r2.id)).unitsFulfilled === 0, `nothing changed on failure`);
await api(hospital, "POST", `/api/supply-offers/${o3.json.id}/respond`, { action: "DECLINE" });
check((await offer(o3.json.id)).status === "DECLINED" && (await notes(B._id, /^Supply offer declined/)) === 1, `decline -> bank notified`);
const o4 = await api(bank, "POST", "/api/supply-offers", { requestId: r2.id, bloodGroup: "A+", units: 2 });
await acceptAndRecord(r2.id);
const a4 = await api(hospital, "POST", `/api/supply-offers/${o4.json.id}/respond`, { action: "ACCEPT" });
check(a4.json.unitsApplied === 1 && (await stock("A+")) === 17 && (await offer(o4.json.id)).units === 1 && (await req(r2.id)).status === "FULFILLED", `only remaining 1 unit applied & deducted`);

// Receiver request offers
const rr = (await api(receiver, "POST", "/api/requests", { bloodGroup: "B+", unitsNeeded: 2, urgency: "URGENT", neededBy: new Date(Date.now() + DAY).toISOString(), hospitalId: String(H._id) })).json;
const o5 = await api(bank, "POST", "/api/supply-offers", { requestId: rr.id, bloodGroup: "B+", units: 1 });
check((await col("notifications").countDocuments({ type: "SUPPLY_OFFER", link: `/receiver/requests/${rr.id}` })) === 1 && (await col("notifications").countDocuments({ type: "SUPPLY_OFFER", link: `/hospital/requests/${rr.id}` })) === 1, `receiver + chosen hospital each notified once`);
check((await api(hospital, "POST", `/api/supply-offers/${o5.json.id}/respond`, { action: "ACCEPT" })).status === 200, `chosen hospital accepts`);
const o6 = await api(bank, "POST", "/api/supply-offers", { requestId: rr.id, bloodGroup: "O+", units: 1 });
check((await api(receiver, "POST", `/api/supply-offers/${o6.json.id}/respond`, { action: "ACCEPT" })).status === 200 && (await req(rr.id)).status === "FULFILLED", `receiver accepts -> fulfilled`);

// Cancel with pending offer
const r3 = await newReq(hospital, { bloodGroup: "B+", unitsNeeded: 1 });
const o7 = await api(bank, "POST", "/api/supply-offers", { requestId: r3.id, bloodGroup: "B+", units: 1 });
await api(hospital, "POST", `/api/requests/${r3.id}/cancel`, {});
check((await offer(o7.json.id)).status === "DECLINED", `cancel declines pending offer`);
check((await api(bank, "POST", "/api/supply-offers", { requestId: r3.id, bloodGroup: "B+", units: 1 })).status === 409, `can't offer on cancelled`);

// Walk-ins
const look = await api(bank, "GET", "/api/bloodbank/donors/lookup?q=donor%40redlink.test");
check(look.json.donor.bloodGroup === "O-" && look.json.donor.eligible, `lookup by email`);
const D = await user("donor@redlink.test");
check((await api(bank, "GET", `/api/bloodbank/donors/lookup?q=${encodeURIComponent("+91 " + D.phone)}`)).json.donor.donorId === look.json.donor.donorId, `lookup by +91 phone`);
const unk = await api(bank, "GET", "/api/bloodbank/donors/lookup?q=nobody%40example.com");
check(unk.status === 200 && unk.json.donor === null, `unknown donor -> { donor: null }`);
const w = await api(bank, "POST", "/api/bloodbank/donations", { donorId: look.json.donor.donorId, units: 1 });
check(w.status === 201 && (await stock("O-")) === 2, `walk-in recorded; O− stock +1`);
const D2 = await user("donor@redlink.test");
check(D2.donorProfile.bloodGroupVerified && D2.donorProfile.lastDonationAt, `donor verified + cooldown`);
const rec = await col("donationrecords").find({ donorId: D._id }).sort({ donatedAt: -1 }).limit(1).next();
check(rec.requestId === null && rec.location === "Ghatkopar Community Blood Bank", `record: no request, location = bank`);
const again = await api(bank, "POST", "/api/bloodbank/donations", { donorId: look.json.donor.donorId, units: 1 });
check(again.status === 409 && /donate again on/.test(again.json.error), `second walk-in blocked ("${again.json?.error}")`);
const unavailable = await col("users").findOne({ role: "DONOR", "donorProfile.isAvailable": false, "donorProfile.lastDonationAt": null });
check((await api(bank, "POST", "/api/bloodbank/donations", { donorId: String(unavailable._id), units: 2 })).status === 201, `availability toggle ignored for walk-ins`);
check((await api(hospital, "POST", "/api/bloodbank/donations", { donorId: String(unavailable._id), units: 1 })).status === 403, `only banks record walk-ins`);
check((await api(await cookieFor("donor@redlink.test"), "GET", "/api/donor/history")).json.history[0].location === "Ghatkopar Community Blood Bank", `walk-in in donor history`);

// Camps
const start = new Date(Date.now() + 3 * DAY);
check((await api(bank, "POST", "/api/bloodbank/camps", { title: "Bad camp", description: "Ends before start", startsAt: start.toISOString(), endsAt: new Date(start - 3600_000).toISOString(), address: "Somewhere", lat: 19.08, lng: 72.9 })).status === 400, `camp ending before start rejected`);
check((await api(bank, "POST", "/api/bloodbank/camps", { title: "Phase 5 Test Camp", description: "Testing camp creation", startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 6 * 3600_000).toISOString(), address: "Ghatkopar West", lat: 19.086, lng: 72.907 })).status === 201, `camp created`);
check((await api(await cookieFor("donor@redlink.test"), "GET", "/api/donor/camps")).json.camps.some((c) => c.title === "Phase 5 Test Camp"), `camp shows for nearby donor`);
check((await api(hospital, "GET", "/api/donations")).json.donations.length > 0 && (await api(bank, "GET", "/api/donations")).json.donations.some((d) => d.requestId === null), `donations lists work for hospital + bank`);

await finish();
