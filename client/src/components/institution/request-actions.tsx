import { BanIcon, ExpandIcon, TimerIcon, ZapIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { CRITICAL_ESCALATED_RADIUS_KM } from "@red-link/shared/domain/constants";
import { formatTime } from "@red-link/shared/format";
import type { RequestView as RequestViewData } from "@red-link/shared/api";

/** Expand radius (URGENT), cancel (with optional reason), and CRITICAL escalation status (Phase 4). */
export function RequestActions({ view, onChanged }: { view: RequestViewData; onChanged: () => void }) {
  const { request: r, viewer } = view;
  const [expanding, setExpanding] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  async function expand() {
    setExpanding(true);
    try {
      const res = await fetch(`/api/requests/${r.id}/expand`, { method: "POST" });
      const data: { radiusKm?: number; newlyNotified?: number; error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't expand the radius.");
        return;
      }
      toast.success(
        `Radius expanded to ${data.radiusKm} km. ${data.newlyNotified} more donor${data.newlyNotified === 1 ? "" : "s"} alerted.`,
      );
      onChanged();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setExpanding(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/requests/${r.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't cancel the request.");
        return;
      }
      toast.success("Request cancelled. Matched donors have been told it's no longer needed.");
      setCancelOpen(false);
      onChanged();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setCancelling(false);
    }
  }

  const showEscalation = r.urgency === "CRITICAL" && (r.escalationDueAt || r.lastEscalatedAt);
  if (!viewer.canExpand && !viewer.canCancel && !showEscalation) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {r.urgency === "CRITICAL" && r.escalationDueAt ? (
        <p className="flex items-start gap-2 text-sm">
          <TimerIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          If fewer than 3 donors accept by {formatTime(r.escalationDueAt)}, the search automatically widens to{" "}
          {CRITICAL_ESCALATED_RADIUS_KM} km and more donors are alerted.
        </p>
      ) : null}
      {r.urgency === "CRITICAL" && r.lastEscalatedAt ? (
        <p className="flex items-start gap-2 text-sm">
          <ZapIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          Search widened automatically to {r.radiusKm} km at {formatTime(r.lastEscalatedAt)}.
        </p>
      ) : null}

      {viewer.canExpand || viewer.canCancel ? (
        <div className="flex flex-wrap gap-2">
          {viewer.canExpand ? (
            <Button variant="outline" onClick={() => void expand()} disabled={expanding}>
              <ExpandIcon />
              {expanding ? "Expanding…" : `Expand radius to ${viewer.nextRadiusKm} km`}
            </Button>
          ) : null}
          {viewer.canCancel ? (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <BanIcon />
              Cancel request
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              Donors who were alerted or accepted will be told it&apos;s no longer needed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              rows={2}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient stabilised, blood arranged from blood bank"
            />
            <p className="text-xs text-muted-foreground">If given, donors see this reason.</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep request</DialogClose>
            <Button variant="destructive" onClick={() => void cancel()} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
