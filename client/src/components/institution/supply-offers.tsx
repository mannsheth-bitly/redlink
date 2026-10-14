import { CheckIcon, WarehouseIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@red-link/shared/format";
import type { RequestView as RequestViewData } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Waiting for your answer", className: "bg-warning/15 text-warning" },
  ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
  DECLINED: { label: "Declined", className: "bg-muted text-muted-foreground" },
};

/** Spec 7.D step 2: blood bank offers on a request; accepting adds the units to the request. */
export function SupplyOffers({ view, onChanged }: { view: RequestViewData; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (view.supplyOffers.length === 0) return null;

  async function respond(id: string, action: "ACCEPT" | "DECLINE") {
    setBusy(id);
    try {
      const res = await fetch(`/api/supply-offers/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: { error?: string; unitsApplied?: number; requestStatus?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't answer the offer.");
        return;
      }
      toast.success(
        action === "ACCEPT"
          ? `${data.unitsApplied} unit${data.unitsApplied === 1 ? "" : "s"} added${data.requestStatus === "FULFILLED" ? ". Request fulfilled!" : "."}`
          : "Offer declined.",
      );
      onChanged();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="offers-heading" className="flex flex-col gap-2">
      <h2 id="offers-heading" className="text-lg font-semibold">
        Blood bank offers ({view.supplyOffers.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {view.supplyOffers.map((o) => {
          const s = STATUS[o.status] ?? { label: o.status, className: "bg-muted" };
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
              <WarehouseIcon className="size-5 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{o.bankName}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {o.units} unit{o.units === 1 ? "" : "s"} of <BloodGroupPill group={o.bloodGroup} className="min-w-9 text-xs" /> ·{" "}
                  {timeAgo(o.createdAt)}
                </p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.className)}>{s.label}</span>
              {o.status === "PENDING" && view.viewer.canRespondOffers ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void respond(o.id, "ACCEPT")} disabled={busy !== null}>
                    <CheckIcon />
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void respond(o.id, "DECLINE")} disabled={busy !== null}>
                    <XIcon />
                    Decline
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
