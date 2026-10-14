import { FlagIcon } from "lucide-react";
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
import { api, ApiError } from "@/lib/api";

/** What is being reported; the server works out the person from it (spec 4: report a user or request). */
export type ReportSubject =
  | { kind: "REQUEST"; requestId: string }
  | { kind: "MATCH"; matchId: string }
  | { kind: "CONTACT"; contactRequestId: string };

const MIN = 10;
const MAX = 500;

/** A small "Report" button that opens a reason box and sends the report to the admins. */
export function ReportButton({ subject, about, size = "sm" }: { subject: ReportSubject; about: string; size?: "sm" | "xs" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const id = `report-${subject.kind}-${"requestId" in subject ? subject.requestId : "matchId" in subject ? subject.matchId : subject.contactRequestId}`;
  const length = reason.trim().length;

  async function send() {
    if (length < MIN) {
      toast.error(`Describe the problem in at least ${MIN} characters.`);
      return;
    }
    setSending(true);
    try {
      await api("/api/flags", { body: { ...subject, reason: reason.trim() } });
      toast.success("Report sent. A Red Link admin will review it.");
      setSent(true);
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={sent}
        aria-label={sent ? `Reported ${about}` : `Report ${about}`}
      >
        <FlagIcon />
        {sent ? "Reported" : "Report"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {about}</DialogTitle>
            <DialogDescription>
              Tell the Red Link admins what went wrong. They&apos;ll review it and may suspend the account. The person you
              report is not told who reported them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>What happened?</Label>
            <Textarea
              id={id}
              rows={4}
              maxLength={MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Accepted the request but never arrived and didn't answer calls."
            />
            <p className="text-xs text-muted-foreground">
              {length < MIN ? `At least ${MIN} characters` : `${length}/${MAX}`}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => void send()} disabled={sending}>
              {sending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
