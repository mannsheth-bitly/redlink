import { HospitalIcon, InboxIcon, MapPinIcon, SendIcon } from "lucide-react";
import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { toast } from "sonner";
import { UrgencyBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { ReportButton } from "@/components/shared/report-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { timeUntil } from "@red-link/shared/format";
import type { SupplyableRequest } from "@red-link/shared/api";

const show = (g: string) => g.replace("-", "−");

function OfferForm({ r, onSent }: { r: SupplyableRequest; onSent: () => void }) {
  const [group, setGroup] = useState<string>(r.options[0]?.bloodGroup ?? "");
  const option = r.options.find((o) => o.bloodGroup === group);
  const [units, setUnits] = useState(String(Math.min(r.stillNeeded, option?.maxUnits ?? 1)));
  const [sending, setSending] = useState(false);

  async function offer() {
    const n = Number(units);
    if (!option || !Number.isInteger(n) || n < 1 || n > option.maxUnits) {
      toast.error(`Offer between 1 and ${option?.maxUnits ?? 0} units.`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/supply-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: r.id, bloodGroup: group, units: n }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't send the offer.");
        return;
      }
      toast.success("Offer sent. Stock is only taken when the requester accepts.");
      onSent();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-36 flex-col gap-1">
        <Label htmlFor={`g-${r.id}`} className="text-xs">
          Group to send
        </Label>
        <NativeSelect id={`g-${r.id}`} value={group} onChange={(e) => setGroup(e.target.value)}>
          {r.options.map((o) => (
            <option key={o.bloodGroup} value={o.bloodGroup}>
              {show(o.bloodGroup)} ({o.units} in stock)
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex w-24 flex-col gap-1">
        <Label htmlFor={`u-${r.id}`} className="text-xs">
          Units (max {option?.maxUnits ?? 0})
        </Label>
        <Input id={`u-${r.id}`} type="number" min={1} max={option?.maxUnits} value={units} onChange={(e) => setUnits(e.target.value)} />
      </div>
      <Button onClick={() => void offer()} disabled={sending || !option}>
        <SendIcon />
        {sending ? "Sending…" : "Offer units"}
      </Button>
    </div>
  );
}

/** Spec 7.D step 1: open requests within 50 km where this bank has compatible stock. */
export function SupplyRequests({ items }: { items: SupplyableRequest[] }) {
  const refresh = useRefresh();
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No open requests you can supply</p>
        <p className="text-sm text-muted-foreground">Requests within 50 km that match your stock will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <BloodGroupPill group={r.bloodGroup} className="text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <UrgencyBadge urgency={r.urgency} />
                {r.isIndividual ? <span className="text-xs text-muted-foreground">Individual request</span> : null}
              </div>
              <p className="mt-1 flex items-center gap-1 font-medium">
                <HospitalIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {r.hospitalName}
              </p>
              <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {r.distanceLabel}
                </span>
                <span>
                  Still needs {r.stillNeeded} of {r.unitsNeeded} units
                </span>
                <span>Needed {timeUntil(r.neededBy)}</span>
              </p>
            </div>
            <ReportButton subject={{ kind: "REQUEST", requestId: r.id }} about="this request" size="xs" />
          </div>
          {r.myOffer ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              {r.myOffer.status === "PENDING"
                ? `You offered ${r.myOffer.units} unit${r.myOffer.units === 1 ? "" : "s"} of ${show(r.myOffer.bloodGroup)}. Waiting for the requester to accept.`
                : `Your offer of ${r.myOffer.units} unit${r.myOffer.units === 1 ? "" : "s"} of ${show(r.myOffer.bloodGroup)} was accepted.`}
            </p>
          ) : (
            <OfferForm r={r} onSent={() => refresh()} />
          )}
        </li>
      ))}
    </ul>
  );
}
