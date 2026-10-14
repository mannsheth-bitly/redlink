import { CircleAlertIcon, SearchIcon } from "lucide-react";
import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_UNITS_PER_DONATION } from "@red-link/shared/domain/constants";
import type { WalkInDonor } from "@red-link/shared/api";

/** Spec 8 /bloodbank/donations: record a walk-in donation, finding the donor by email or phone. */
export function WalkInForm() {
  const refresh = useRefresh();
  const [query, setQuery] = useState("");
  const [donor, setDonor] = useState<WalkInDonor | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [units, setUnits] = useState(1);
  const [saving, setSaving] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setNotFound(null);
    setDonor(null);
    try {
      const res = await fetch(`/api/bloodbank/donors/lookup?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data: { donor?: WalkInDonor | null; error?: string } = await res.json();
      if (!res.ok) setNotFound(data.error ?? "Search failed.");
      else if (!data.donor) setNotFound("No donor found with that email or phone.");
      else setDonor(data.donor);
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setSearching(false);
    }
  }

  async function record() {
    if (!donor) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bloodbank/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: donor.donorId, units }),
      });
      const data: { error?: string; bloodGroup?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't record the donation.");
        return;
      }
      toast.success(`Donation recorded. ${units} unit${units === 1 ? "" : "s"} of ${data.bloodGroup} added to stock.`);
      setDonor(null);
      setQuery("");
      setUnits(1);
      refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => void lookup(e)} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <Label htmlFor="donor-query">Donor&apos;s email or phone</Label>
          <Input
            id="donor-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. donor@redlink.test or 9000000011"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline" disabled={searching || query.trim().length < 5}>
          <SearchIcon />
          {searching ? "Searching…" : "Find donor"}
        </Button>
      </form>
      {notFound ? <p className="text-sm text-destructive">{notFound}</p> : null}

      {donor ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <BloodGroupPill group={donor.bloodGroup} />
            <span className="font-semibold">{donor.name}</span>
            {donor.verified ? <VerifiedBadge /> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {donor.email} · {donor.phone}
          </p>
          {donor.eligible ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Units collected</legend>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_UNITS_PER_DONATION }, (_, i) => i + 1).map((n) => (
                    <label
                      key={n}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input type="radio" name="walkin-units" checked={units === n} onChange={() => setUnits(n)} className="accent-primary" />
                      {n} unit{n === 1 ? "" : "s"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button onClick={() => void record()} disabled={saving}>
                {saving ? "Saving…" : "Record walk-in donation"}
              </Button>
              <p className="text-xs text-muted-foreground">
                This verifies the donor&apos;s blood group, starts their 90-day rest and adds the units to your stock.
              </p>
            </>
          ) : (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-semibold">Can&apos;t donate right now</p>
                <ul>
                  {donor.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
