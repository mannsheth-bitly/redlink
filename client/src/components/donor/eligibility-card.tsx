import { CalendarClockIcon, CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { formatDay } from "@red-link/shared/format";
import { cn } from "@/lib/utils";

interface Eligibility {
  eligible: boolean;
  reasons: string[];
  nextEligibleDate: string | null;
  inCooldown: boolean;
}

/** Eligibility card: eligible, or why not and when they can donate again (spec 5.3 / 8). */
export function EligibilityCard({ eligibility }: { eligibility: Eligibility }) {
  const { eligible, reasons, nextEligibleDate, inCooldown } = eligibility;
  const Icon = eligible ? CheckCircle2Icon : inCooldown ? CalendarClockIcon : CircleAlertIcon;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        eligible ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10",
      )}
    >
      <Icon className={cn("mt-0.5 size-6 shrink-0", eligible ? "text-success" : "text-warning")} aria-hidden="true" />
      <div>
        <p className="font-semibold">{eligible ? "You're eligible to donate" : "Not eligible right now"}</p>
        {eligible ? (
          <p className="text-sm text-muted-foreground">
            {nextEligibleDate
              ? `Your 90-day rest period ended on ${formatDay(nextEligibleDate)}.`
              : "Thank you for being ready to help."}
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-sm">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
