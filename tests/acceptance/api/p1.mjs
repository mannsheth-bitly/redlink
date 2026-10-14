// Phase 1 (API level): auth, roles, signup, session safety.
import { api, BASE, check, finish, login } from "./lib.mjs";

const ACCOUNTS = [
  ["admin@redlink.test", "/admin", "ADMIN"],
  ["hospital@redlink.test", "/hospital", "HOSPITAL"],
  ["emergency@redlink.test", "/emergency", "EMERGENCY"],
  ["bloodbank@redlink.test", "/bloodbank", "BLOOD_BANK"],
  ["newhospital@redlink.test", "/hospital", "HOSPITAL"],
  ["receiver@redlink.test", "/receiver", "RECEIVER"],
  ["donor@redlink.test", "/donor", "DONOR"],
];

check((await api(null, "GET", "/api/public/stats")).status === 200, `public stats (logged out) -> 200`);
const loggedOutMe = await api(null, "GET", "/api/auth/me");
check(loggedOutMe.status === 200 && loggedOutMe.json.user === null, `/api/auth/me logged out -> { user: null }`);

for (const [email, home, role] of ACCOUNTS) {
  const s = await login(email);
  check(s.status === 200 && s.body.redirectTo === home, `login ${email} -> ${s.status} redirectTo=${s.body.redirectTo}`);
  check(!!s.rawCookie && /HttpOnly/i.test(s.rawCookie) && /SameSite=Lax/i.test(s.rawCookie), `  cookie is httpOnly + SameSite=Lax`);
  const meRes = await api(s.cookie, "GET", "/api/auth/me");
  check(meRes.status === 200 && meRes.json.user.role === role, `  /me -> role ${meRes.json?.user?.role}`);
  check(!meRes.text.includes("passwordHash") && !meRes.text.includes("$2"), `  /me never includes the password hash`);
}
const pending = await login("newhospital@redlink.test");
const pendingMe = await api(pending.cookie, "GET", "/api/auth/me");
check(pendingMe.json.user.status === "PENDING_VERIFICATION", `pending hospital's status is PENDING_VERIFICATION (client shows "Awaiting verification")`);
check((await api(pending.cookie, "GET", "/api/requests")).status === 403, `pending hospital blocked from institution APIs`);

const bad = await login("donor@redlink.test", "wrong-password");
check(bad.status === 401 && bad.body.error === "Incorrect email or password.", `wrong password -> 401`);
const unknown = await login("nobody@redlink.test", "whatever1");
check(unknown.status === 401 && unknown.body.error === bad.body.error, `unknown email gives the same message (no probing)`);
const tampered = await api("redlink_session=not-a-real-token", "GET", "/api/auth/me");
check(tampered.json.user === null && /redlink_session=;/.test(tampered.headers.get("set-cookie") ?? ""), `tampered cookie -> logged out and cookie cleared`);
check((await api("redlink_session=not-a-real-token", "GET", "/api/donor/feed")).status === 401, `tampered cookie can't use protected APIs (401)`);

// Wrong-role API access
const donor = (await login("donor@redlink.test")).cookie;
check((await api(donor, "GET", "/api/bloodbank/inventory")).status === 403, `donor -> blood bank API 403`);
check((await api(donor, "GET", "/api/requests")).status === 403, `donor -> institution API 403`);

// Signup
const email = `test.${Date.now()}@example.com`;
const sign = await api(null, "POST", "/api/auth/signup", {
  role: "DONOR", name: "Test Donor", email, phone: "+91 98765 43210", password: "password123",
  location: { lat: 19.08, lng: 72.9, address: "Test address", city: "Mumbai", pincode: "400077" },
  bloodGroup: "A+", dateOfBirth: "1999-01-01", gender: "FEMALE", weightKg: 60,
});
check(sign.status === 201 && sign.json.redirectTo === "/donor", `signup donor -> ${sign.status}`);
const dup = await api(null, "POST", "/api/auth/signup", { role: "RECEIVER", name: "X Y", email, phone: "9876543210", password: "password123", location: { lat: 19, lng: 72.9, address: "abc", city: "Mumbai", pincode: "400077" } });
check(dup.status === 409, `duplicate email -> 409`);
check((await api(null, "POST", "/api/auth/signup", { role: "ADMIN", name: "X", email: "a@b.c" })).status === 400, `signup as ADMIN rejected`);
const inst = await api(null, "POST", "/api/auth/signup", { role: "BLOOD_BANK", name: "Contact Person", email: `bb.${Date.now()}@example.com`, phone: "9876543211", password: "password123", orgName: "Test Blood Bank", licenseNumber: "LIC-1", location: { lat: 19, lng: 72.9, address: "abc", city: "Mumbai", pincode: "400077" } });
const instCookie = inst.headers.getSetCookie().find((c) => c.startsWith("redlink_session="))?.split(";")[0];
check(inst.status === 201 && (await api(instCookie, "GET", "/api/auth/me")).json.user.status === "PENDING_VERIFICATION", `new blood bank signup -> pending`);
check((await api(null, "POST", "/api/auth/login", "not json")).status === 400, `bad body -> 400`);
check((await api(donor, "GET", "/api/requests/not-an-id")).status === 404, `invalid id -> 404 (no crash)`);
check((await fetch(`${BASE}/api/nope`)).status === 404, `unknown API route -> 404 JSON`);

await finish();
