import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { formatDateTime, formatTime } from "@red-link/shared/format";

interface Camp {
  id: string;
  title: string;
  description: string;
  address: string;
  startsAt: string;
  endsAt: string;
  organiser: string;
  distanceLabel: string;
}

export function CampsList({ camps, radiusKm }: { camps: Camp[]; radiusKm: number }) {
  if (camps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No upcoming donation camps within {radiusKm} km.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {camps.map((c) => (
        <li key={c.id} className="rounded-xl border bg-card p-4">
          <p className="font-semibold">{c.title}</p>
          <p className="text-sm text-muted-foreground">by {c.organiser}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm">
            <CalendarDaysIcon className="size-4 text-primary" aria-hidden="true" />
            {formatDateTime(c.startsAt)} – {formatTime(c.endsAt)}
          </p>
          <p className="flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
            {c.address} · {c.distanceLabel}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
        </li>
      ))}
    </ul>
  );
}
