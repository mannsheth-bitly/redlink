import {
  ActivityIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClipboardListIcon,
  FlagIcon,
  HeartHandshakeIcon,
  PercentIcon,
  ShieldCheckIcon,
  TimerIcon,
  UsersIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats } from "@red-link/shared/api";
import { formatDuration } from "@red-link/shared/domain/analytics";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {label}
      </p>
      <p className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ActionLink({ to, icon: Icon, label, count }: { to: string; icon: typeof FlagIcon; label: string; count: number }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50",
        count > 0 && "border-primary/40",
      )}
    >
      <Icon className={cn("size-5", count > 0 ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span className="flex-1 font-medium">{label}</span>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums",
          count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

const shortDay = (key: string) =>
  new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  cursor: { fill: "var(--muted)" },
};

/** Spec 8 /admin: totals, fulfilment rate, average time to first acceptance, two charts. */
export default function AdminHomePage() {
  usePageTitle("Admin analytics");
  const { data, error, reload } = useApi<AdminStats>("/api/admin/stats");

  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return <SectionLoading rows={4} />;
  const t = data.totals;
  const byGroup = data.byBloodGroup.map((g) => ({ group: g.bloodGroup.replace("-", "−"), requests: g.requests }));
  const daily = data.last14Days.map((d) => ({ day: shortDay(d.day), Created: d.created, Fulfilled: d.fulfilled }));
  const anyDaily = data.last14Days.some((d) => d.created > 0 || d.fulfilled > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin analytics</h1>
        <p className="text-muted-foreground">Live figures across Red Link.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ActionLink to="/admin/verifications" icon={ShieldCheckIcon} label="Institutions awaiting verification" count={data.pending.verifications} />
        <ActionLink to="/admin/flags" icon={FlagIcon} label="Open flags to review" count={data.pending.openFlags} />
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={UsersIcon} label="Total donors" value={t.donors} hint="Active donor accounts" />
        <StatCard icon={HeartHandshakeIcon} label="Available now" value={t.availableNow} hint="Available and eligible to donate today" />
        <StatCard icon={ClipboardListIcon} label="Open requests" value={t.openRequests} hint="Open or partly fulfilled" />
        <StatCard icon={CheckCircle2Icon} label="Fulfilled this month" value={t.fulfilledThisMonth} hint="Since the 1st (IST)" />
        <StatCard
          icon={PercentIcon}
          label="Fulfilment rate"
          value={t.fulfilmentRate === null ? "—" : `${t.fulfilmentRate}%`}
          hint={`Fulfilled out of ${t.closedRequests} closed request${t.closedRequests === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={TimerIcon}
          label="Avg. time to first acceptance"
          value={formatDuration(t.avgFirstAcceptanceMinutes)}
          hint="From request created to the first donor accepting"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requests by blood group</CardTitle>
            <CardDescription>All requests ever raised, by the patient&apos;s blood group.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64" role="img" aria-label={`Bar chart. ${byGroup.map((g) => `${g.group}: ${g.requests}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGroup} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="group" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="requests" name="Requests" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests over the last 14 days</CardTitle>
            <CardDescription>Requests created and fulfilled each day (IST).</CardDescription>
          </CardHeader>
          <CardContent>
            {anyDaily ? (
              <div
                className="h-64"
                role="img"
                aria-label={`Bar chart of the last 14 days. ${data.last14Days
                  .filter((d) => d.created || d.fulfilled)
                  .map((d) => `${shortDay(d.day)}: ${d.created} created, ${d.fulfilled} fulfilled`)
                  .join("; ")}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--border)" interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Created" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fulfilled" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <ActivityIcon className="size-8" aria-hidden="true" />
                <p>No requests in the last 14 days.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
