import { AlertTriangleIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { Button } from "@/components/ui/button";
import type { InventoryTile } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

/** Spec 8: 8-tile inventory grid, low stock in red, quick adjust buttons. */
export function InventoryGrid({ initial }: { initial: InventoryTile[] }) {
  const [tiles, setTiles] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function adjust(bloodGroup: string, delta: number) {
    setBusy(bloodGroup);
    try {
      const res = await fetch("/api/bloodbank/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloodGroup, delta }),
      });
      const data: { inventory?: InventoryTile[]; error?: string } = await res.json();
      if (!res.ok || !data.inventory) {
        toast.error(data.error ?? "Couldn't update stock.");
        return;
      }
      setTiles(data.inventory);
      const t = data.inventory.find((i) => i.bloodGroup === bloodGroup);
      toast.success(`${bloodGroup.replace("-", "−")}: ${t?.units} unit${t?.units === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  const total = tiles.reduce((s, t) => s + t.units, 0);
  const low = tiles.filter((t) => t.low);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg border bg-card px-3 py-2">
          Total stock: <strong className="tabular-nums">{total}</strong> units
        </span>
        {low.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-primary">
            <AlertTriangleIcon className="size-4" aria-hidden="true" />
            Low stock: {low.map((t) => t.bloodGroup.replace("-", "−")).join(", ")}
          </span>
        ) : (
          <span className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-success">All groups above threshold</span>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <li
            key={t.bloodGroup}
            className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", t.low && "border-primary bg-primary/5")}
          >
            <div className="flex items-center justify-between">
              <BloodGroupPill group={t.bloodGroup} />
              {t.low ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
                  Low
                </span>
              ) : null}
            </div>
            <p className={cn("text-4xl font-extrabold tabular-nums", t.low && "text-primary")}>
              {t.units}
              <span className="ml-1 text-sm font-medium text-muted-foreground">units</span>
            </p>
            <p className="text-xs text-muted-foreground">Low at {t.lowStockThreshold} or fewer</p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => void adjust(t.bloodGroup, -1)}
                disabled={busy !== null || t.units === 0}
                aria-label={`Remove 1 unit of ${t.bloodGroup}`}
              >
                <MinusIcon />1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => void adjust(t.bloodGroup, 1)}
                disabled={busy !== null}
                aria-label={`Add 1 unit of ${t.bloodGroup}`}
              >
                <PlusIcon />1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => void adjust(t.bloodGroup, 5)}
                disabled={busy !== null}
                aria-label={`Add 5 units of ${t.bloodGroup}`}
              >
                <PlusIcon />5
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
