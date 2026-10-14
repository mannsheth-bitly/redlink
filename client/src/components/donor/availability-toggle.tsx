import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

/** "Available to donate" toggle (spec 3 / 8). Controls whether new requests can match this donor. */
export function AvailabilityToggle({ initial }: { initial: boolean }) {
  const refresh = useRefresh();
  const [available, setAvailable] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: boolean) {
    setAvailable(next);
    setSaving(true);
    try {
      const res = await fetch("/api/donor/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "You're available to donate" : "You're now hidden from new requests");
      refresh();
    } catch {
      setAvailable(!next);
      toast.error("Couldn't update availability. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
      <div>
        <p id="availability-label" className="font-semibold">
          Available to donate
        </p>
        <p className="text-sm text-muted-foreground">
          {available ? "Hospitals nearby can find you for matching requests." : "You won't be matched to new requests."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" aria-hidden="true">
          {available ? "On" : "Off"}
        </span>
        <Switch
          checked={available}
          onCheckedChange={(v) => void change(v)}
          disabled={saving}
          aria-labelledby="availability-label"
        />
      </div>
    </div>
  );
}
