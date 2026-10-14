// Shared helpers for the API acceptance scripts (see docs/TEST_PLAN.md).
// They call the running API and read MongoDB directly to check what was stored.
// Run each on a freshly seeded database: npm run db:seed && node tests/acceptance/api/p1.mjs
import { createRequire } from "node:module";
import path from "node:path";

export const PROJECT = process.env.PROJECT ?? path.resolve(import.meta.dirname, "..", "..", "..");
export const BASE = process.env.BASE ?? "http://localhost:4000";
// The MongoDB driver comes with Mongoose in the server workspace.
const require = createRequire(path.join(PROJECT, "server", "package.json"));
const { MongoClient, ObjectId } = require("mongodb");
export { ObjectId };

export const client = new MongoClient(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/?replicaSet=rs0");
await client.connect();
export const db = client.db("redlink");
export const col = (name) => db.collection(name);

let failures = 0;
export const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
export async function finish() {
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  await client.close();
  process.exitCode = failures ? 1 : 0;
}

export const DAY = 86_400_000;

export async function login(email, password = "demo1234") {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("redlink_session="));
  return { status: res.status, body: await res.json(), cookie: cookie?.split(";")[0], rawCookie: cookie };
}
export async function cookieFor(email) {
  const r = await login(email);
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return r.cookie;
}
export async function api(cookie, method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
export const user = (email) => col("users").findOne({ email });
export const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
export const hav = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
export const oid = (s) => new ObjectId(String(s));
