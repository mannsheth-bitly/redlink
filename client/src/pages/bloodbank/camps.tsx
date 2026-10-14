import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { CampForm } from "@/components/bloodbank/camp-form";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampRow } from "@red-link/shared/api";
import { formatDateTime, formatTime } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

function CampList({ items, empty }: { items: CampRow[]; empty: string }) {
  if (items.length === 0) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => (
        <li key={c.id} className="rounded-xl border bg-card p-4">
          <p className="font-semibold">{c.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <CalendarDaysIcon className="size-4 text-primary" aria-hidden="true" />
            {formatDateTime(c.startsAt)} – {formatTime(c.endsAt)}
          </p>
          <p className="flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
            {c.address}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
        </li>
      ))}
    </ul>
  );
}

/** Spec 8 /bloodbank/camps: create and list camps (shown on nearby donors' home page). */
export default function CampsPage() {
  usePageTitle("Donation camps");
  const user = useUser();
  const { data, error, reload } = useApi<{ camps: CampRow[] }>("/api/bloodbank/camps");
  const upcoming = data?.camps.filter((c) => !c.ended) ?? [];
  const past = data?.camps.filter((c) => c.ended).reverse() ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Donation camps</h1>
        {error ? <PageError error={error} onRetry={reload} /> : null}
        {!data && !error ? <SectionLoading rows={2} /> : null}
        {data ? (
          <section aria-labelledby="upcoming-heading" className="flex flex-col gap-2">
            <h2 id="upcoming-heading" className="font-semibold">
              Upcoming ({upcoming.length})
            </h2>
            <CampList items={upcoming} empty="No upcoming camps. Create one to invite donors nearby." />
          </section>
        ) : null}
        {past.length > 0 ? (
          <section aria-labelledby="past-heading" className="flex flex-col gap-2">
            <h2 id="past-heading" className="font-semibold">
              Past
            </h2>
            <CampList items={past} empty="" />
          </section>
        ) : null}
      </div>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Create a camp</CardTitle>
        </CardHeader>
        <CardContent>
          <CampForm
            defaultLocation={user.lat !== null && user.lng !== null ? { lat: user.lat, lng: user.lng } : null}
            defaultAddress={user.address ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
