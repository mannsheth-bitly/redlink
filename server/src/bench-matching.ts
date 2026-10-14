/**
 * Matching benchmark for docs/NON_FUNCTIONAL.md: 10,000 synthetic donors, timed with and
 * without the bounding-box prefilter. Uses a separate "<db>_bench" database, which is dropped
 * afterwards, so the demo data is untouched. Run with `npm run bench`.
 */
import mongoose, { Types } from "mongoose";
import type { BloodGroup } from "@red-link/shared/domain/constants";
import { findMatches, type MatchDonorInput } from "@red-link/shared/domain/matching";
import { connectDb, disconnectDb, transaction } from "./db.ts";
import { env } from "./env.ts";
import { ALL_MODELS, Notification, RequestMatch, User } from "./models.ts";
import { loadCandidateDonors, matchAndNotify } from "./services/matching.ts";

const DONORS = 10_000;
const RUNS = 7;
const CENTRE = { lat: 19.07, lng: 72.9 };
// Rough Indian blood-group mix (spec 12): O+ 35, B+ 30, A+ 20, AB+ 7, negatives 8.
const MIX: [BloodGroup, number][] = [["O+", 35], ["B+", 30], ["A+", 20], ["AB+", 7], ["O-", 3], ["A-", 2], ["B-", 2], ["AB-", 1]];

function benchUri(uri: string) {
  const u = new URL(uri);
  u.pathname = `/${u.pathname.replace(/^\//, "") || "redlink"}_bench`;
  return u.toString();
}

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pickGroup = () => {
  let r = rand() * 100;
  for (const [g, w] of MIX) if ((r -= w) < 0) return g;
  return "O+" as BloodGroup;
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function time(label: string, fn: () => Promise<number>) {
  const ms: number[] = [];
  let found = 0;
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    found = await fn();
    ms.push(performance.now() - t);
  }
  console.log(`${label.padEnd(58)} median ${median(ms).toFixed(1).padStart(7)} ms   max ${Math.max(...ms).toFixed(1).padStart(7)} ms   (${found} results)`);
}

async function main() {
  await connectDb(benchUri(env.mongoUri));
  await mongoose.connection.dropDatabase();
  await Promise.all(ALL_MODELS.map((m) => m.syncIndexes()));

  // Donors spread over a ~60 km radius (Mumbai metropolitan region), most available and eligible.
  const now = new Date();
  const docs = Array.from({ length: DONORS }, (_, i) => {
    const angle = rand() * 2 * Math.PI;
    const km = Math.sqrt(rand()) * 60;
    return {
      role: "DONOR",
      name: `Bench Donor ${i}`,
      email: `bench${i}@example.com`,
      phone: `9${String(100000000 + i).slice(0, 9)}`,
      passwordHash: "x",
      lat: CENTRE.lat + (km / 111) * Math.sin(angle),
      lng: CENTRE.lng + (km / (111 * Math.cos((CENTRE.lat * Math.PI) / 180))) * Math.cos(angle),
      donorProfile: {
        bloodGroup: pickGroup(),
        dateOfBirth: new Date(Date.UTC(1975 + Math.floor(rand() * 30), 0, 1)),
        gender: rand() < 0.5 ? "MALE" : "FEMALE",
        weightKg: 50 + Math.floor(rand() * 40),
        isAvailable: rand() < 0.85,
        bloodGroupVerified: rand() < 0.3,
        lastDonationAt: rand() < 0.2 ? new Date(now.getTime() - rand() * 120 * 86_400_000) : null,
      },
    };
  });
  await User.insertMany(docs);
  console.log(`Inserted ${DONORS.toLocaleString("en-IN")} synthetic donors within 60 km of the centre.\n`);

  const creator = String(new Types.ObjectId());
  const request = (radiusKm: number, bloodGroup: BloodGroup) => ({
    bloodGroup,
    lat: CENTRE.lat,
    lng: CENTRE.lng,
    radiusKm,
    createdById: creator,
    alreadyMatchedDonorIds: new Set<string>(),
  });

  // Without the prefilter: load every donor, then filter in code.
  const allDonors = async (): Promise<MatchDonorInput[]> =>
    (await User.find({ role: "DONOR" }, { status: 1, lat: 1, lng: 1, donorProfile: 1 }).lean()).map((u) => ({
      id: String(u._id),
      status: u.status,
      lat: u.lat ?? null,
      lng: u.lng ?? null,
      bloodGroup: u.donorProfile!.bloodGroup as BloodGroup,
      isAvailable: u.donorProfile!.isAvailable,
      bloodGroupVerified: u.donorProfile!.bloodGroupVerified,
      dateOfBirth: u.donorProfile!.dateOfBirth,
      weightKg: u.donorProfile!.weightKg,
      lastDonationAt: u.donorProfile!.lastDonationAt ?? null,
    }));

  for (const [label, radiusKm, group] of [
    ["NORMAL 10 km, B+", 10, "B+"],
    ["URGENT 25 km, O+", 25, "O+"],
    ["CRITICAL 50 km, AB+ (every group compatible)", 50, "AB+"],
    ["CRITICAL escalated 100 km, AB+", 100, "AB+"],
  ] as const) {
    await time(`${label}: bounding box + Haversine`, async () => {
      const donors = await loadCandidateDonors({ ...request(radiusKm, group) });
      return findMatches(request(radiusKm, group), donors, new Date()).length;
    });
    await time(`${label}: no prefilter (all ${DONORS / 1000}k donors)`, async () =>
      findMatches(request(radiusKm, group), await allDonors(), new Date()).length,
    );
  }

  // End to end: matching + saving 50 RequestMatch rows + 50 notifications in one transaction.
  await time("URGENT 25 km, O+: full broadcast (match + save + notify)", async () => {
    const id = String(new Types.ObjectId());
    const matches = await transaction((ctx) =>
      matchAndNotify(ctx, { id, bloodGroup: "O+", urgency: "URGENT", unitsNeeded: 2, hospitalName: "Bench Hospital", lat: CENTRE.lat, lng: CENTRE.lng, radiusKm: 25, createdById: creator }, new Date()),
    );
    await RequestMatch.deleteMany({ requestId: id });
    await Notification.deleteMany({});
    return matches.length;
  });

  console.log(`\nEach line: ${RUNS} runs. Node ${process.version}, MongoDB ${(await mongoose.connection.db!.admin().serverInfo()).version}.`);
  await mongoose.connection.dropDatabase();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
