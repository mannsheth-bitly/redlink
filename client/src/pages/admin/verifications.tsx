import { BadgeCheckIcon, Building2Icon, CheckIcon, MailIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageError, SectionLoading } from "@/components/shared/page-state";
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
import { Textarea } from "@/components/ui/textarea";
import type { VerificationItem } from "@red-link/shared/api";
import { ROLE_LABEL, type Role } from "@red-link/shared/domain/constants";
import { formatDay, timeAgo } from "@red-link/shared/format";
import { api, ApiError, useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";
import { useRefresh } from "@/lib/refresh";

function Details({ v }: { v: VerificationItem }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <dt className="sr-only">Licence</dt>
        <BadgeCheckIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <dd>
          Licence / registration: <span className="font-mono font-medium">{v.licenseNumber}</span>
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Contact person</dt>
        <Building2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <dd>Contact: {v.contactName}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Email</dt>
        <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <dd className="break-all">{v.email}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">Phone</dt>
        <PhoneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <dd>{v.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</dd>
      </div>
      <div className="flex items-start gap-2 sm:col-span-2">
        <dt className="sr-only">Address</dt>
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <dd>{v.address || "No address given"}</dd>
      </div>
    </dl>
  );
}

/** Spec 7.C: approve (ACTIVE) or reject with a note; the applicant is notified either way. */
export default function VerificationsPage() {
  usePageTitle("Verifications");
  const refresh = useRefresh();
  const { data, error, reload } = useApi<{ pending: VerificationItem[]; rejected: VerificationItem[] }>("/api/admin/verifications");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VerificationItem | null>(null);
  const [note, setNote] = useState("");

  async function decide(v: VerificationItem, action: "APPROVE" | "REJECT", rejectNote?: string) {
    setBusy(v.id);
    try {
      await api(`/api/admin/verifications/${v.id}`, { body: { action, ...(rejectNote ? { note: rejectNote } : {}) } });
      toast.success(action === "APPROVE" ? `${v.orgName} approved. They can now use Red Link.` : `${v.orgName} rejected. They've been told why.`);
      setRejecting(null);
      setNote("");
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save the decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verification queue</h1>
        <p className="text-muted-foreground">
          Hospitals, emergency services and blood banks can&apos;t use Red Link until you approve them. Check the licence
          number before approving.
        </p>
      </div>

      {error ? <PageError error={error} onRetry={reload} /> : null}
      {!data && !error ? <SectionLoading /> : null}

      {data ? (
        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <h2 id="pending-heading" className="text-lg font-semibold">
            Waiting for review ({data.pending.length})
          </h2>
          {data.pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <ShieldCheckIcon className="size-8 text-success" aria-hidden="true" />
              <p className="font-medium">All caught up</p>
              <p className="text-sm text-muted-foreground">New institution sign-ups will appear here.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.pending.map((v) => (
                <li key={v.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{v.orgName}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{ROLE_LABEL[v.role as Role] ?? v.role}</span>
                    <span className="ml-auto text-xs text-muted-foreground">Applied {timeAgo(v.appliedAt)}</span>
                  </div>
                  <Details v={v} />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void decide(v, "APPROVE")} disabled={busy !== null}>
                      <CheckIcon />
                      {busy === v.id ? "Saving…" : "Approve"}
                    </Button>
                    <Button variant="outline" onClick={() => setRejecting(v)} disabled={busy !== null}>
                      <XIcon />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {data && data.rejected.length > 0 ? (
        <section aria-labelledby="rejected-heading" className="flex flex-col gap-3">
          <h2 id="rejected-heading" className="text-lg font-semibold">
            Rejected ({data.rejected.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {data.rejected.map((v) => (
              <li key={v.id} className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-sm opacity-80">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{v.orgName}</span>
                  <span className="text-muted-foreground">
                    {ROLE_LABEL[v.role as Role] ?? v.role} · applied {formatDay(v.appliedAt)}
                  </span>
                </p>
                {v.rejectionNote ? <p className="text-muted-foreground">Note: &ldquo;{v.rejectionNote}&rdquo;</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.orgName}?</DialogTitle>
            <DialogDescription>
              The applicant sees this note when they log in, so explain what was wrong (e.g. the licence number could
              not be verified).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-note">Note to the applicant</Label>
            <Textarea id="reject-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={busy !== null || note.trim().length < 3}
              onClick={() => rejecting && void decide(rejecting, "REJECT", note.trim())}
            >
              {busy ? "Saving…" : "Reject application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
