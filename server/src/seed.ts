/**
 * Resets the database and creates realistic Mumbai demo data (spec Section 12).
 * Run with `npm run db:seed`. All people, phone numbers and organisations are fictional.
 */
import bcrypt from "bcryptjs";
import mongoose, { type Types } from "mongoose";
import { BLOOD_GROUPS, type BloodGroup, type Urgency } from "@red-link/shared/domain/constants";
import { haversineKm, type LatLng } from "@red-link/shared/domain/geo";
import { findMatches, type MatchDonorInput } from "@red-link/shared/domain/matching";
import { initialRadiusKm } from "@red-link/shared/domain/requests";
import { connectDb, disconnectDb } from "./db.ts";
import { env } from "./env.ts";
import {
  ALL_MODELS,
  BloodRequest,
  DonationCamp,
  DonationRecord,
  Flag,
  InventoryItem,
  Notification,
  RequestMatch,
  User,
} from "./models.ts";

const NOW = new Date();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

/** Centre of the demo area: Vidyavihar / Ghatkopar (spec Section 12). */
const CENTRE: LatLng = { lat: 19.07, lng: 72.9 };

// Small deterministic PRNG so every reset produces the same data.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261013);
const jitter = (p: LatLng, deg = 0.004): LatLng => ({
  lat: p.lat + (rand() - 0.5) * 2 * deg,
  lng: p.lng + (rand() - 0.5) * 2 * deg,
});

/** Real Mumbai / Thane / Navi Mumbai localities (approximate centre points). */
const LOCALITIES: { name: string; pincode: string; city: string; at: LatLng }[] = [
  { name: "Vidyavihar", pincode: "400077", city: "Mumbai", at: { lat: 19.079, lng: 72.897 } },
  { name: "Ghatkopar East", pincode: "400077", city: "Mumbai", at: { lat: 19.079, lng: 72.908 } },
  { name: "Ghatkopar West", pincode: "400086", city: "Mumbai", at: { lat: 19.086, lng: 72.907 } },
  { name: "Kurla West", pincode: "400070", city: "Mumbai", at: { lat: 19.065, lng: 72.879 } },
  { name: "Chembur", pincode: "400071", city: "Mumbai", at: { lat: 19.062, lng: 72.9 } },
  { name: "Powai", pincode: "400076", city: "Mumbai", at: { lat: 19.1176, lng: 72.906 } },
  { name: "Vikhroli", pincode: "400079", city: "Mumbai", at: { lat: 19.111, lng: 72.928 } },
  { name: "Kanjurmarg", pincode: "400042", city: "Mumbai", at: { lat: 19.129, lng: 72.928 } },
  { name: "Bhandup", pincode: "400078", city: "Mumbai", at: { lat: 19.144, lng: 72.937 } },
  { name: "Mulund West", pincode: "400080", city: "Mumbai", at: { lat: 19.172, lng: 72.956 } },
  { name: "Thane West", pincode: "400601", city: "Thane", at: { lat: 19.197, lng: 72.964 } },
  { name: "Sion", pincode: "400022", city: "Mumbai", at: { lat: 19.04, lng: 72.862 } },
  { name: "Matunga", pincode: "400019", city: "Mumbai", at: { lat: 19.027, lng: 72.85 } },
  { name: "Dadar", pincode: "400014", city: "Mumbai", at: { lat: 19.018, lng: 72.844 } },
  { name: "Wadala", pincode: "400031", city: "Mumbai", at: { lat: 19.017, lng: 72.864 } },
  { name: "Parel", pincode: "400012", city: "Mumbai", at: { lat: 19.0, lng: 72.841 } },
  { name: "Byculla", pincode: "400027", city: "Mumbai", at: { lat: 18.979, lng: 72.833 } },
  { name: "Bandra East", pincode: "400051", city: "Mumbai", at: { lat: 19.06, lng: 72.849 } },
  { name: "Santacruz East", pincode: "400055", city: "Mumbai", at: { lat: 19.08, lng: 72.854 } },
  { name: "Andheri East", pincode: "400069", city: "Mumbai", at: { lat: 19.115, lng: 72.869 } },
  { name: "Saki Naka", pincode: "400072", city: "Mumbai", at: { lat: 19.103, lng: 72.888 } },
  { name: "Goregaon East", pincode: "400063", city: "Mumbai", at: { lat: 19.163, lng: 72.86 } },
  { name: "Govandi", pincode: "400043", city: "Mumbai", at: { lat: 19.055, lng: 72.915 } },
  { name: "Mankhurd", pincode: "400088", city: "Mumbai", at: { lat: 19.048, lng: 72.932 } },
  { name: "Vashi", pincode: "400703", city: "Navi Mumbai", at: { lat: 19.077, lng: 72.999 } },
  { name: "Nerul", pincode: "400706", city: "Navi Mumbai", at: { lat: 19.033, lng: 73.018 } },
  { name: "Airoli", pincode: "400708", city: "Navi Mumbai", at: { lat: 19.157, lng: 72.999 } },
  { name: "Colaba", pincode: "400005", city: "Mumbai", at: { lat: 18.907, lng: 72.815 } },
  { name: "Mira Road", pincode: "401107", city: "Mira-Bhayandar", at: { lat: 19.281, lng: 72.87 } },
  { name: "Bhayandar West", pincode: "401101", city: "Mira-Bhayandar", at: { lat: 19.301, lng: 72.851 } },
  { name: "Kasarvadavali", pincode: "400615", city: "Thane", at: { lat: 19.268, lng: 72.97 } },
  { name: "Panvel", pincode: "410206", city: "Navi Mumbai", at: { lat: 18.99, lng: 73.117 } },
];
const locality = (name: string) => {
  const l = LOCALITIES.find((x) => x.name === name);
  if (!l) throw new Error(`Unknown locality ${name}`);
  return l;
};

// 40 donors. Blood groups follow spec 12: O+ 14 (35%), B+ 12 (30%), A+ 8 (20%), AB+ 3 (~7%), negatives 3 (~8%).
const DONOR_GROUPS: BloodGroup[] = [
  ...Array<BloodGroup>(14).fill("O+"),
  ...Array<BloodGroup>(12).fill("B+"),
  ...Array<BloodGroup>(8).fill("A+"),
  ...Array<BloodGroup>(3).fill("AB+"),
  "O-",
  "A-",
  "B-",
];

const DONOR_NAMES: { name: string; gender: "MALE" | "FEMALE" }[] = [
  { name: "Rahul Sharma", gender: "MALE" },
  { name: "Sneha Kulkarni", gender: "FEMALE" },
  { name: "Amit Patil", gender: "MALE" },
  { name: "Pooja Patel", gender: "FEMALE" },
  { name: "Rohan Deshmukh", gender: "MALE" },
  { name: "Ananya Iyer", gender: "FEMALE" },
  { name: "Vikram Iyer", gender: "MALE" },
  { name: "Neha Singh", gender: "FEMALE" },
  { name: "Sandeep Kulkarni", gender: "MALE" },
  { name: "Kavya Reddy", gender: "FEMALE" },
  { name: "Arjun Nair", gender: "MALE" },
  { name: "Riya Desai", gender: "FEMALE" },
  { name: "Karan Malhotra", gender: "MALE" },
  { name: "Shruti Jadhav", gender: "FEMALE" },
  { name: "Siddharth Joshi", gender: "MALE" },
  { name: "Meera Pillai", gender: "FEMALE" },
  { name: "Imran Shaikh", gender: "MALE" },
  { name: "Aisha Khan", gender: "FEMALE" },
  { name: "Nikhil Gupta", gender: "MALE" },
  { name: "Divya Chavan", gender: "FEMALE" },
  { name: "Pranav Shetty", gender: "MALE" },
  { name: "Isha Thakkar", gender: "FEMALE" },
  { name: "Aditya Rao", gender: "MALE" },
  { name: "Tanvi Sawant", gender: "FEMALE" },
  { name: "Harsh Vora", gender: "MALE" },
  { name: "Nisha Fernandes", gender: "FEMALE" },
  { name: "Manoj Pawar", gender: "MALE" },
  { name: "Swati More", gender: "FEMALE" },
  { name: "Suresh Yadav", gender: "MALE" },
  { name: "Prachi Naik", gender: "FEMALE" },
  { name: "Farhan Qureshi", gender: "MALE" },
  { name: "Anjali Verma", gender: "FEMALE" },
  { name: "Tejas Gaikwad", gender: "MALE" },
  { name: "Fatima Ansari", gender: "FEMALE" },
  { name: "Varun Menon", gender: "MALE" },
  { name: "Komal Shinde", gender: "FEMALE" },
  { name: "Kunal Bhatt", gender: "MALE" },
  { name: "Rutuja Bhosale", gender: "FEMALE" },
  { name: "Abhishek Mishra", gender: "MALE" },
  { name: "Simran Kaur", gender: "FEMALE" },
];

/** Fictional numbers in a fixed 90000xxxxx block. */
let phoneCounter = 0;
const nextPhone = () => `90000${String(++phoneCounter).padStart(5, "0")}`;


async function reset() {
  await mongoose.connection.dropDatabase();
  await Promise.all(ALL_MODELS.map((m) => m.syncIndexes()));
}

const id = (doc: { _id: unknown }) => String(doc._id);

async function main() {
  await connectDb(env.mongoUri);
  console.log("Resetting database…");
  await reset();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  // ---------- Admin ----------
  const admin = await User.create({
    role: "ADMIN",
    name: "Red Link Admin",
    email: "admin@redlink.test",
    phone: nextPhone(),
    passwordHash,
    city: "Mumbai",
  });

  // ---------- Institutions ----------
  async function institution(opts: {
    role: "HOSPITAL" | "EMERGENCY" | "BLOOD_BANK";
    email: string;
    contact: string;
    orgName: string;
    licenseNumber: string;
    at: string;
    address: string;
    verified: boolean;
  }) {
    const loc = locality(opts.at);
    return User.create({
      role: opts.role,
      status: opts.verified ? "ACTIVE" : "PENDING_VERIFICATION",
      name: opts.contact,
      email: opts.email,
      phone: nextPhone(),
      passwordHash,
      lat: loc.at.lat,
      lng: loc.at.lng,
      address: opts.address,
      city: loc.city,
      pincode: loc.pincode,
      createdAt: ago(200 * DAY),
      institution: {
        type: opts.role,
        orgName: opts.orgName,
        licenseNumber: opts.licenseNumber,
        verifiedAt: opts.verified ? ago(190 * DAY) : null,
        verifiedById: opts.verified ? admin._id : null,
      },
    });
  }

  const hospital = await institution({ role: "HOSPITAL", email: "hospital@redlink.test", contact: "Dr. Meenal Joshi", orgName: "Vidyavihar General Hospital", licenseNumber: "MH-HOSP-2019-0412", at: "Vidyavihar", address: "Station Road, Vidyavihar East", verified: true });
  const emergency = await institution({ role: "EMERGENCY", email: "emergency@redlink.test", contact: "Rajesh Patankar", orgName: "Mumbai Rapid Response Ambulance Service", licenseNumber: "MH-EMS-2021-0088", at: "Ghatkopar East", address: "Pant Nagar, Ghatkopar East", verified: true });
  const bloodBank = await institution({ role: "BLOOD_BANK", email: "bloodbank@redlink.test", contact: "Dr. Sunita Rane", orgName: "Ghatkopar Community Blood Bank", licenseNumber: "MH-BB-2017-0231", at: "Ghatkopar West", address: "LBS Marg, Ghatkopar West", verified: true });
  await institution({ role: "HOSPITAL", email: "newhospital@redlink.test", contact: "Dr. Faisal Merchant", orgName: "New Life Hospital", licenseNumber: "MH-HOSP-2026-1150", at: "Kurla West", address: "Kurla-Andheri Road, Kurla West", verified: false });
  const powaiHospital = await institution({ role: "HOSPITAL", email: "powai.hospital@example.com", contact: "Dr. Kiran Bedi", orgName: "Powai Lakeside Hospital", licenseNumber: "MH-HOSP-2015-0907", at: "Powai", address: "Hiranandani Gardens, Powai", verified: true });
  const chemburHospital = await institution({ role: "HOSPITAL", email: "chembur.hospital@example.com", contact: "Dr. Alok Saxena", orgName: "Chembur Care Hospital", licenseNumber: "MH-HOSP-2012-0356", at: "Chembur", address: "Diamond Garden, Chembur", verified: true });

  // ---------- Receiver ----------
  const receiverAt = jitter(locality("Ghatkopar West").at);
  const receiver = await User.create({
    role: "RECEIVER",
    name: "Sanjay Kapoor",
    email: "receiver@redlink.test",
    phone: nextPhone(),
    passwordHash,
    lat: receiverAt.lat,
    lng: receiverAt.lng,
    address: "Garodia Nagar, Ghatkopar East",
    city: "Mumbai",
    pincode: "400077",
    createdAt: ago(150 * DAY),
  });

  // ---------- Donors ----------
  interface SeedDonor {
    id: string;
    name: string;
    bloodGroup: BloodGroup;
    at: LatLng;
  }
  const donors: SeedDonor[] = [];

  // Main demo donor: O−, available, eligible, never donated through Red Link.
  const demoDonorAt = jitter(locality("Vidyavihar").at, 0.002);
  const demoDonor = await User.create({
    role: "DONOR",
    name: "Aarav Mehta",
    email: "donor@redlink.test",
    phone: nextPhone(),
    passwordHash,
    lat: demoDonorAt.lat,
    lng: demoDonorAt.lng,
    address: "Rajawadi, Vidyavihar East",
    city: "Mumbai",
    pincode: "400077",
    createdAt: ago(100 * DAY),
    donorProfile: { bloodGroup: "O-", dateOfBirth: new Date("2000-03-14T00:00:00.000Z"), gender: "MALE", weightKg: 72, isAvailable: true },
  });
  donors.push({ id: id(demoDonor), name: demoDonor.name, bloodGroup: "O-", at: demoDonorAt });

  // Spread the 40 donors over the localities (0–30 km from the centre).
  const donorLocalities = LOCALITIES.filter((l) => haversineKm(CENTRE, l.at) <= 29);
  for (let i = 0; i < DONOR_NAMES.length; i++) {
    const { name, gender } = DONOR_NAMES[i];
    const loc = donorLocalities[i % donorLocalities.length];
    const at = jitter(loc.at);
    const age = 19 + Math.floor(rand() * 40); // 19–58
    const dob = new Date(Date.UTC(NOW.getUTCFullYear() - age, Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)));
    const [first, last] = name.toLowerCase().split(" ");
    const user = await User.create({
      role: "DONOR",
      name,
      email: `${first}.${last}@example.com`,
      phone: nextPhone(),
      passwordHash,
      lat: at.lat,
      lng: at.lng,
      address: loc.name,
      city: loc.city,
      pincode: loc.pincode,
      createdAt: ago((30 + Math.floor(rand() * 300)) * DAY),
      donorProfile: { bloodGroup: DONOR_GROUPS[i], dateOfBirth: dob, gender, weightKg: Math.round(52 + rand() * 38), isAvailable: true },
    });
    donors.push({ id: id(user), name, bloodGroup: DONOR_GROUPS[i], at });
  }

  const HOSPITAL_ADDRESSES: Record<string, string> = {
    "Vidyavihar General Hospital": "Station Road, Vidyavihar East, Mumbai 400077",
    "Powai Lakeside Hospital": "Hiranandani Gardens, Powai, Mumbai 400076",
    "Chembur Care Hospital": "Diamond Garden, Chembur, Mumbai 400071",
  };

  // ---------- 6 past fulfilled requests with donation records ----------
  const usedDonorIds = new Set<string>([id(demoDonor)]);
  const pastRequests: {
    creator: { _id: Types.ObjectId };
    recorder: { _id: Types.ObjectId };
    hospitalName: string;
    at: LatLng;
    bloodGroup: BloodGroup;
    units: number;
    urgency: Urgency;
    createdAgo: number;
    firstResponseMinutes: number;
    note: string;
  }[] = [
    { creator: hospital, recorder: hospital, hospitalName: "Vidyavihar General Hospital", at: locality("Vidyavihar").at, bloodGroup: "B+", units: 2, urgency: "URGENT", createdAgo: 2 * DAY, firstResponseMinutes: 6, note: "Post-operative bleeding" },
    { creator: emergency, recorder: hospital, hospitalName: "Vidyavihar General Hospital", at: locality("Ghatkopar East").at, bloodGroup: "O+", units: 3, urgency: "CRITICAL", createdAgo: 5 * DAY, firstResponseMinutes: 3, note: "Road accident, trauma ICU" },
    { creator: powaiHospital, recorder: powaiHospital, hospitalName: "Powai Lakeside Hospital", at: locality("Powai").at, bloodGroup: "A+", units: 1, urgency: "NORMAL", createdAgo: 9 * DAY, firstResponseMinutes: 41, note: "Planned surgery" },
    { creator: chemburHospital, recorder: chemburHospital, hospitalName: "Chembur Care Hospital", at: locality("Chembur").at, bloodGroup: "O+", units: 2, urgency: "URGENT", createdAgo: 12 * DAY, firstResponseMinutes: 14, note: "Dengue patient, low platelets" },
    { creator: hospital, recorder: hospital, hospitalName: "Vidyavihar General Hospital", at: locality("Vidyavihar").at, bloodGroup: "B+", units: 2, urgency: "NORMAL", createdAgo: 45 * DAY, firstResponseMinutes: 27, note: "Thalassemia transfusion" },
    { creator: receiver, recorder: hospital, hospitalName: "Vidyavihar General Hospital", at: locality("Vidyavihar").at, bloodGroup: "AB+", units: 1, urgency: "URGENT", createdAgo: 120 * DAY, firstResponseMinutes: 19, note: "Mother's surgery" },
  ];

  for (const p of pastRequests) {
    const createdAt = ago(p.createdAgo);
    const radiusKm = initialRadiusKm(p.urgency);
    // Nearest unused donors with the exact group donate; the next two declined.
    const candidates = donors
      .filter((d) => !usedDonorIds.has(d.id))
      .map((d) => ({ ...d, distanceKm: haversineKm(p.at, d.at) }))
      .filter((d) => d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    const donated = candidates.filter((d) => d.bloodGroup === p.bloodGroup).slice(0, p.units);
    if (donated.length < p.units) throw new Error(`Not enough ${p.bloodGroup} donors for past request`);
    const declined = candidates.filter((d) => !donated.includes(d) && d.bloodGroup === p.bloodGroup).slice(0, 2);
    donated.forEach((d) => usedDonorIds.add(d.id));

    const request = await BloodRequest.create({
      createdById: p.creator._id,
      // Receiver requests record donations at the chosen hospital (owner decision).
      recordingHospitalId: p.creator === receiver ? hospital._id : null,
      bloodGroup: p.bloodGroup,
      unitsNeeded: p.units,
      unitsFulfilled: p.units,
      urgency: p.urgency,
      status: "FULFILLED",
      patientNote: p.note,
      hospitalName: p.hospitalName,
      hospitalAddress: HOSPITAL_ADDRESSES[p.hospitalName],
      lat: p.at.lat,
      lng: p.at.lng,
      radiusKm,
      neededBy: new Date(createdAt.getTime() + DAY),
      createdAt,
      fulfilledAt: new Date(createdAt.getTime() + 5 * HOUR),
    });

    for (const [i, d] of donated.entries()) {
      const respondedAt = new Date(createdAt.getTime() + (p.firstResponseMinutes + i * 7) * MINUTE);
      const donatedAt = new Date(createdAt.getTime() + (2 + i) * HOUR);
      await RequestMatch.create({ requestId: request._id, donorId: d.id, distanceKm: d.distanceKm, score: 0, status: "DONATED", notifiedAt: createdAt, respondedAt });
      await DonationRecord.create({ donorId: d.id, requestId: request._id, recordedById: p.recorder._id, units: 1, donatedAt, location: p.hospitalName });
      // Recording a donation verifies the blood group and starts the cooldown (spec 7.A step 5).
      await User.updateOne({ _id: d.id }, { "donorProfile.lastDonationAt": donatedAt, "donorProfile.bloodGroupVerified": true });
    }
    for (const d of declined) {
      await RequestMatch.create({ requestId: request._id, donorId: d.id, distanceKm: d.distanceKm, score: 0, status: "DECLINED", notifiedAt: createdAt, respondedAt: new Date(createdAt.getTime() + 30 * MINUTE) });
    }
  }

  // ---------- Some donors marked unavailable ----------
  const unavailable = donors.filter((d) => !usedDonorIds.has(d.id) && d.id !== id(demoDonor)).filter((_, i) => i % 7 === 3);
  for (const d of unavailable) await User.updateOne({ _id: d.id }, { "donorProfile.isAvailable": false });

  // ---------- 7 verified donors past their cooldown (owner decision, Phase 6) ----------
  // Earlier walk-in donations at the blood bank, 100+ days ago, so the "Verified only" search
  // filter has results. Chosen from the existing 40 (nearest the centre first), so the total stays 40.
  const unavailableIds = new Set(unavailable.map((d) => d.id));
  const pool = donors
    .filter((d) => !usedDonorIds.has(d.id) && !unavailableIds.has(d.id))
    .sort((a, b) => haversineKm(CENTRE, a.at) - haversineKm(CENTRE, b.at));
  const wanted: BloodGroup[] = ["O+", "B+", "A+", "O+", "B+", "AB+", "A+"];
  for (const [i, group] of wanted.entries()) {
    const d = pool.find((p) => p.bloodGroup === group && !usedDonorIds.has(p.id));
    if (!d) throw new Error(`No ${group} donor left for the verified set`);
    usedDonorIds.add(d.id);
    const donatedAt = ago((100 + i * 17) * DAY);
    await DonationRecord.create({ donorId: d.id, recordedById: bloodBank._id, units: 1, donatedAt, location: "Ghatkopar Community Blood Bank" });
    await User.updateOne({ _id: d.id }, { "donorProfile.lastDonationAt": donatedAt, "donorProfile.bloodGroupVerified": true });
  }

  // ---------- 2 open requests, matched with the real matching function ----------
  const allDonors = await User.find({ role: "DONOR" }).lean();
  const matchInputs: MatchDonorInput[] = allDonors.flatMap((u) =>
    u.donorProfile
      ? [
          {
            id: id(u),
            status: u.status,
            lat: u.lat ?? null,
            lng: u.lng ?? null,
            bloodGroup: u.donorProfile.bloodGroup as BloodGroup,
            isAvailable: u.donorProfile.isAvailable,
            bloodGroupVerified: u.donorProfile.bloodGroupVerified,
            dateOfBirth: u.donorProfile.dateOfBirth,
            weightKg: u.donorProfile.weightKg,
            lastDonationAt: u.donorProfile.lastDonationAt ?? null,
          },
        ]
      : [],
  );

  const openRequests: {
    creator: { _id: Types.ObjectId };
    hospitalName: string;
    at: LatLng;
    bloodGroup: BloodGroup;
    units: number;
    urgency: Urgency;
    createdAgo: number;
    neededIn: number;
    note: string;
    acceptFirst: boolean;
  }[] = [
    { creator: hospital, hospitalName: "Vidyavihar General Hospital", at: locality("Vidyavihar").at, bloodGroup: "B+" as BloodGroup, units: 2, urgency: "URGENT" as Urgency, createdAgo: 30 * MINUTE, neededIn: DAY, note: "Surgery scheduled, post-op transfusion", acceptFirst: true },
    { creator: powaiHospital, hospitalName: "Powai Lakeside Hospital", at: locality("Powai").at, bloodGroup: "A+" as BloodGroup, units: 1, urgency: "NORMAL" as Urgency, createdAgo: 3 * HOUR, neededIn: 3 * DAY, note: "Anaemia, planned transfusion", acceptFirst: false },
  ];

  for (const o of openRequests) {
    const createdAt = ago(o.createdAgo);
    const radiusKm = initialRadiusKm(o.urgency);
    const request = await BloodRequest.create({
      createdById: o.creator._id,
      bloodGroup: o.bloodGroup,
      unitsNeeded: o.units,
      urgency: o.urgency,
      status: "OPEN",
      patientNote: o.note,
      hospitalName: o.hospitalName,
      hospitalAddress: HOSPITAL_ADDRESSES[o.hospitalName],
      lat: o.at.lat,
      lng: o.at.lng,
      radiusKm,
      neededBy: new Date(NOW.getTime() + o.neededIn),
      createdAt,
    });
    const matches = findMatches(
      { bloodGroup: o.bloodGroup, lat: o.at.lat, lng: o.at.lng, radiusKm, createdById: id(o.creator), alreadyMatchedDonorIds: new Set() },
      matchInputs,
      NOW,
    );
    for (const [i, m] of matches.entries()) {
      // The demo donor stays NOTIFIED so they can respond during a demo.
      const accepted = o.acceptFirst && i === 0 && m.donorId !== id(demoDonor);
      await RequestMatch.create({
        requestId: request._id,
        donorId: m.donorId,
        distanceKm: m.distanceKm,
        score: m.score,
        status: accepted ? "ACCEPTED" : "NOTIFIED",
        notifiedAt: createdAt,
        respondedAt: accepted ? new Date(createdAt.getTime() + 8 * MINUTE) : null,
      });
      await Notification.create({
        userId: m.donorId,
        type: "REQUEST_MATCH",
        priority: o.urgency,
        title: `${o.urgency === "NORMAL" ? "" : `${o.urgency}: `}${o.bloodGroup} blood needed`,
        body: `${o.units} unit${o.units > 1 ? "s" : ""} needed at ${o.hospitalName}. You're a compatible donor nearby.`,
        link: `/donor/requests/${id(request)}`,
        createdAt,
        readAt: accepted ? new Date(createdAt.getTime() + 8 * MINUTE) : null,
      });
    }
    console.log(`Open ${o.bloodGroup} ${o.urgency} request matched ${matches.length} donors`);
  }

  // ---------- Verification notifications for verified institutions ----------
  for (const inst of [hospital, emergency, bloodBank, powaiHospital, chemburHospital]) {
    await Notification.create({
      userId: inst._id,
      type: "VERIFICATION",
      title: "Organisation verified",
      body: "Your organisation has been verified. You can now use all Red Link features.",
      createdAt: ago(190 * DAY),
      readAt: ago(189 * DAY),
    });
  }

  // ---------- Blood bank inventory (O− low on stock) ----------
  const stock: Record<BloodGroup, number> = { "O-": 2, "O+": 24, "A-": 6, "A+": 18, "B-": 7, "B+": 21, "AB-": 8, "AB+": 11 };
  for (const g of BLOOD_GROUPS) {
    await InventoryItem.create({ bloodBankId: bloodBank._id, bloodGroup: g, units: stock[g], lowStockThreshold: 5 });
  }

  // ---------- 2 upcoming camps ----------
  const at9amIst = (daysAhead: number) => {
    const d = ahead(daysAhead * DAY);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 30)); // 09:00 IST
  };
  const camps = [
    { title: "Vidyavihar Campus Blood Donation Drive", description: "Open to all healthy adults aged 18–65. Bring a photo ID. Refreshments provided.", day: 7, hours: 7, address: "Vidyavihar East, near station", at: locality("Vidyavihar").at },
    { title: "Ghatkopar Community Blood Camp", description: "Community drive organised with local housing societies. Walk-ins welcome.", day: 14, hours: 6, address: "Community Hall, Ghatkopar West", at: locality("Ghatkopar West").at },
  ];
  for (const c of camps) {
    const startsAt = at9amIst(c.day);
    await DonationCamp.create({ bloodBankId: bloodBank._id, title: c.title, description: c.description, startsAt, endsAt: new Date(startsAt.getTime() + c.hours * HOUR), address: c.address, lat: c.at.lat, lng: c.at.lng });
  }

  // ---------- 1 open flag ----------
  const flagged = donors.find((d) => !usedDonorIds.has(d.id) && d.id !== id(demoDonor) && d.bloodGroup === "O+");
  await Flag.create({ reporterId: hospital._id, targetUserId: flagged?.id ?? null, reason: "Accepted two requests but did not arrive and did not answer calls.", createdAt: ago(3 * DAY) });

  // ---------- Summary ----------
  const counts = {
    users: await User.countDocuments(),
    donors: await User.countDocuments({ role: "DONOR" }),
    requests: await BloodRequest.countDocuments(),
    donations: await DonationRecord.countDocuments(),
    matches: await RequestMatch.countDocuments(),
    notifications: await Notification.countDocuments(),
  };
  console.log("Seed complete:", counts);
  console.log(`Donors spread up to ${Math.max(...donors.map((d) => haversineKm(CENTRE, d.at))).toFixed(1)} km from the centre`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
