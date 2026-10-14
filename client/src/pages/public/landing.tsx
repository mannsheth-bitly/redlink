import {
  AmbulanceIcon,
  BellRingIcon,
  BuildingIcon,
  HeartHandshakeIcon,
  HospitalIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
  WarehouseIcon,
} from "lucide-react";
import { Link } from "react-router";
import { CompatibilityChart } from "@/components/shared/compatibility-chart";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicStats } from "@red-link/shared/api";
import { useApi } from "@/lib/api";

const STEPS = [
  {
    icon: BellRingIcon,
    title: "1. Broadcast a need",
    body: "A hospital, emergency service or patient's family posts the blood group, units needed, urgency and location.",
  },
  {
    icon: MapPinIcon,
    title: "2. Instant matching",
    body: "Red Link finds donors with a compatible blood group who are nearby, available and eligible to donate, and ranks them.",
  },
  {
    icon: HeartHandshakeIcon,
    title: "3. Donate & track",
    body: "Matched donors are alerted and respond in one tap. The hospital records the donation and the request is tracked until it's fulfilled.",
  },
];

const ROLES = [
  { icon: UserIcon, title: "Donors", body: "Set availability, see nearby requests that match your blood group, respond in one tap." },
  { icon: SearchIcon, title: "Patients & families", body: "Search compatible donors nearby and request contact. Donor details stay private until they accept." },
  { icon: HospitalIcon, title: "Hospitals", body: "Broadcast requirements to matched donors and record completed donations." },
  { icon: AmbulanceIcon, title: "Emergency services", body: "Critical broadcasts with a wider radius that expands automatically if too few donors respond." },
  { icon: WarehouseIcon, title: "Blood banks", body: "Track stock for every blood group, supply open requests and post donation camps." },
  { icon: ShieldCheckIcon, title: "Admins", body: "Verify institutions, keep the platform safe and monitor how quickly requests are met." },
];

export default function LandingPage() {
  const { data: stats } = useApi<PublicStats>("/api/public/stats");
  const statItems = [
    { label: "Registered donors", value: stats?.registeredDonors },
    { label: "Donors ready to donate now", value: stats?.donorsReadyNow },
    { label: "Requests fulfilled", value: stats?.requestsFulfilled },
    { label: "Units donated", value: stats?.unitsDonated },
  ];

  return (
    <>
      <section className="border-b bg-gradient-to-b from-primary/10 to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Blood donation, connected
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            The right donor, <span className="text-primary">found in seconds</span> — not hours.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Red Link matches urgent blood requests with compatible, eligible donors nearby, and alerts them
            instantly. No phone chains, no forwarded messages.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup?role=DONOR" className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}>
              Become a donor
            </Link>
            <Link
              to="/signup?role=RECEIVER"
              className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-5 text-base" })}
            >
              I need blood
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="stats-heading" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="stats-heading" className="sr-only">
          Live statistics
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statItems.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-5">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 text-3xl font-extrabold tabular-nums">{s.value === undefined ? "—" : s.value.toLocaleString("en-IN")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="problem-heading" className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 id="problem-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              The problem
            </h2>
            <p className="mt-3 text-muted-foreground">
              Urgent blood requests usually travel through slow, informal channels: phone calls, WhatsApp forwards
              and walk-ins. Messages reach people who can&apos;t help, details get lost, and nobody knows whether
              the need has already been met. In an emergency, that lost time matters.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Our approach</h2>
            <p className="mt-3 text-muted-foreground">
              A single platform where every request is matched automatically using blood group compatibility,
              distance, availability and donation eligibility, and tracked until it&apos;s fulfilled. Donor phone
              numbers are only shared after the donor agrees.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-7 text-primary" aria-hidden="true" />
                <CardTitle className="mt-2 text-lg">{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="roles-heading" className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="roles-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for everyone in the chain
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardContent className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="compat-heading" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="compat-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Who can donate to whom?
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Red Link matches on red-cell compatibility, not just identical groups. O− donors can give to everyone;
          AB+ patients can receive from everyone. Exact-group donors are ranked first so O− donors stay free for
          the patients who need them most.
        </p>
        <div className="mt-6">
          <CompatibilityChart />
        </div>
      </section>

      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BuildingIcon className="size-8 shrink-0" aria-hidden="true" />
            <p className="text-lg font-semibold">
              Hospital, emergency service or blood bank? Register your organisation for verification.
            </p>
          </div>
          <Link
            to="/signup?role=HOSPITAL"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "h-11 px-5 text-base" })}
          >
            Register organisation
          </Link>
        </div>
      </section>
    </>
  );
}
