import { ListIcon, MapIcon, MapPinIcon, MessageSquareIcon, SearchIcon, UsersIcon } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { LocationPicker } from "@/components/map/location-picker";
import type { MapGroup } from "@/components/map/results-map";
import { VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { compatibleDonorGroups } from "@red-link/shared/domain/compatibility";
import { BLOOD_GROUPS, RECEIVER_SEARCH_RADII_KM, type BloodGroup } from "@red-link/shared/domain/constants";
import type { LatLng } from "@red-link/shared/domain/geo";
import type { DonorSearchResult } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

const ResultsMap = lazy(() => import("@/components/map/results-map"));

const show = (g: string) => g.replace("-", "−");

function ContactDialog({
  donor,
  onClose,
  onSent,
}: {
  donor: DonorSearchResult | null;
  onClose: () => void;
  onSent: (donorId: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!donor) return;
    if (message.trim().length < 5) {
      setError("Write a short message (at least 5 characters).");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: donor.donorId, message }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't send the request.");
        return;
      }
      toast.success(`Request sent to ${donor.displayName}. You'll be notified when they reply.`);
      onSent(donor.donorId);
      onClose();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={donor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request contact with {donor?.displayName}</DialogTitle>
          <DialogDescription>
            The donor sees your name and message. Their phone number is shared with you only if they accept, and
            yours with them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            rows={4}
            maxLength={300}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
            placeholder="e.g. My father needs 2 units of O+ at Vidyavihar General Hospital by tomorrow evening."
            aria-invalid={!!error}
            aria-describedby={error ? "contact-error" : "contact-count"}
          />
          <p id="contact-count" className="text-right text-xs text-muted-foreground">
            {message.length}/300
          </p>
          {error ? (
            <p id="contact-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => void send()} disabled={sending}>
            {sending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Masked donor search (spec 7.B). Receivers can request contact; hospitals and emergency
 * services see the same masked results without the contact button (owner decision).
 */
export function DonorSearch({ initialCentre, allowContact }: { initialCentre: LatLng; allowContact: boolean }) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [centre, setCentre] = useState<LatLng>(initialCentre);
  const [changingLocation, setChangingLocation] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [results, setResults] = useState<DonorSearchResult[] | null>(null);
  const [searchedFor, setSearchedFor] = useState<{ group: BloodGroup; radiusKm: number; centre: LatLng } | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const [contacting, setContacting] = useState<DonorSearchResult | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!bloodGroup) {
      setGroupError(true);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        bloodGroup,
        lat: String(centre.lat),
        lng: String(centre.lng),
        radiusKm: String(radiusKm),
        verifiedOnly: String(verifiedOnly),
      });
      const res = await fetch(`/api/donors/search?${qs}`, { cache: "no-store" });
      const data: { results?: DonorSearchResult[]; error?: string } = await res.json();
      if (!res.ok || !data.results) {
        toast.error(data.error ?? "Search failed.");
        return;
      }
      setResults(data.results);
      setSearchedFor({ group: bloodGroup, radiusKm, centre });
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const groups: MapGroup[] = useMemo(() => {
    const byCell = new Map<string, MapGroup>();
    for (const r of results ?? []) {
      const key = `${r.approxLocation.lat},${r.approxLocation.lng}`;
      const g = byCell.get(key) ?? { key, at: r.approxLocation, labels: [] };
      g.labels.push(`${r.displayName} (${show(r.bloodGroup)})`);
      byCell.set(key, g);
    }
    return [...byCell.values()];
  }, [results]);

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={(e) => void search(e)} className="flex flex-col gap-4 rounded-xl border bg-card p-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="search-group">Patient&apos;s blood group</Label>
            <NativeSelect
              id="search-group"
              value={bloodGroup}
              aria-invalid={groupError}
              aria-describedby="search-group-hint"
              onChange={(e) => {
                setBloodGroup(e.target.value as BloodGroup | "");
                setGroupError(false);
              }}
            >
              <option value="">Select…</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {show(g)}
                </option>
              ))}
            </NativeSelect>
            <p id="search-group-hint" className={cn("text-xs", groupError ? "text-destructive" : "text-muted-foreground")}>
              {groupError
                ? "Choose the patient's blood group."
                : bloodGroup
                  ? `Shows donors with ${compatibleDonorGroups(bloodGroup).map(show).join(", ")} blood`
                  : "We'll include every compatible donor group."}
            </p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Distance</legend>
            <div className="flex gap-1.5">
              {RECEIVER_SEARCH_RADII_KM.map((r) => (
                <label
                  key={r}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input type="radio" name="radius" className="sr-only" checked={radiusKm === r} onChange={() => setRadiusKm(r)} />
                  {r} km
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          Verified donors only
        </label>

        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
              Searching around {centre.lat.toFixed(4)}, {centre.lng.toFixed(4)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setChangingLocation((v) => !v)}>
              {changingLocation ? "Done" : "Change location"}
            </Button>
          </div>
          {changingLocation ? <LocationPicker value={centre} onChange={setCentre} /> : null}
        </div>

        <p className="text-xs text-muted-foreground">Only donors who can donate right now are shown.</p>

        <Button type="submit" size="lg" className="h-11 text-base" disabled={loading}>
          <SearchIcon />
          {loading ? "Searching…" : "Search donors"}
        </Button>
      </form>

      {loading && !results ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {results && searchedFor ? (
        <section aria-labelledby="results-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-heading" className="flex items-center gap-2 text-lg font-semibold">
              <UsersIcon className="size-5 text-primary" aria-hidden="true" />
              {results.length} donor{results.length === 1 ? "" : "s"} for {show(searchedFor.group)} within {searchedFor.radiusKm} km
            </h2>
            <div className="flex rounded-lg border p-0.5" role="group" aria-label="Result view">
              <Button
                type="button"
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <ListIcon />
                List
              </Button>
              <Button
                type="button"
                variant={view === "map" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "map"}
                onClick={() => setView("map")}
              >
                <MapIcon />
                Map
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">No donors available right now</p>
              <p className="text-sm text-muted-foreground">
                Try a larger distance{allowContact ? ", or raise a request so matched donors are alerted when they become available" : ""}.
              </p>
            </div>
          ) : view === "map" ? (
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-xl" />}>
                <ResultsMap centre={searchedFor.centre} radiusKm={searchedFor.radiusKm} groups={groups} onTileError={() => setTilesFailed(true)} />
              </Suspense>
              <p className="text-xs text-muted-foreground">
                {tilesFailed ? "Map images couldn't load (you may be offline). " : ""}
                Pins show approximate areas (~1 km), never exact addresses. Hover or tap a pin for names.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((r) => {
                const sent = r.contactStatus === "PENDING";
                const connected = r.contactStatus === "ACCEPTED";
                return (
                  <li key={r.donorId} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
                    <BloodGroupPill group={r.bloodGroup} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {r.displayName}
                        {r.verified ? <VerifiedBadge /> : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {show(r.bloodGroup)} · {r.distanceLabel} · Available now
                      </p>
                    </div>
                    {allowContact ? (
                      <Button
                        size="sm"
                        variant={sent || connected ? "outline" : "default"}
                        disabled={sent || connected}
                        onClick={() => setContacting(r)}
                      >
                        <MessageSquareIcon />
                        {connected ? "Connected" : sent ? "Request sent" : "Request contact"}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Names are shortened and distances are approximate to protect donors&apos; privacy.
          </p>
        </section>
      ) : null}

      {allowContact ? (
        <ContactDialog
          key={contacting?.donorId ?? "none"}
          donor={contacting}
          onClose={() => setContacting(null)}
          onSent={(id) => setResults((rs) => rs?.map((r) => (r.donorId === id ? { ...r, contactStatus: "PENDING" } : r)) ?? rs)}
        />
      ) : null}
    </div>
  );
}
