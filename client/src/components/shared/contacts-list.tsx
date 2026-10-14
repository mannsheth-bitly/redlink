import { CheckIcon, InboxIcon, PhoneIcon, XIcon } from "lucide-react";
import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { ReportButton } from "@/components/shared/report-button";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@red-link/shared/format";
import type { ContactRequestItem } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Waiting for reply", className: "bg-warning/15 text-warning" },
  ACCEPTED: { label: "Number shared", className: "bg-success/15 text-success" },
  DECLINED: { label: "Declined", className: "bg-muted text-muted-foreground" },
};

/** Contact requests: receivers see what they sent, donors answer what they received (spec 7.B). */
export function ContactsList({ items, mode }: { items: ContactRequestItem[]; mode: "receiver" | "donor" }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(id: string, action: "ACCEPT" | "DECLINE") {
    setBusy(id);
    try {
      const res = await fetch(`/api/contact-requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save your reply.");
        return;
      }
      toast.success(action === "ACCEPT" ? "Numbers shared. You can now call each other." : "Request declined.");
      refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No contact requests yet</p>
        <p className="text-sm text-muted-foreground">
          {mode === "receiver"
            ? "Search for donors and send a contact request to get their number."
            : "When someone who needs blood asks for your number, it will appear here."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => {
        const s = STATUS[c.status] ?? { label: c.status, className: "bg-muted" };
        return (
          <li key={c.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              {c.bloodGroup ? <BloodGroupPill group={c.bloodGroup} /> : null}
              <span className="font-semibold">{c.otherName}</span>
              {c.verified ? <VerifiedBadge /> : null}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.className)}>{s.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
              <ReportButton subject={{ kind: "CONTACT", contactRequestId: c.id }} about={c.otherName} size="xs" />
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-sm">&ldquo;{c.message}&rdquo;</p>
            {c.otherPhone ? (
              <a
                href={`tel:+91${c.otherPhone}`}
                className="flex w-fit items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <PhoneIcon className="size-4 text-success" aria-hidden="true" />
                Call {c.otherName}: {c.otherPhone.replace(/(\d{5})(\d{5})/, "$1 $2")}
              </a>
            ) : null}
            {mode === "receiver" && c.status === "DECLINED" ? (
              <p className="text-sm text-muted-foreground">
                This donor isn&apos;t able to help right now. Thank you for understanding — try another donor or raise a
                request.
              </p>
            ) : null}
            {mode === "donor" && c.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void respond(c.id, "ACCEPT")} disabled={busy !== null}>
                  <CheckIcon />
                  Share my number
                </Button>
                <Button variant="outline" onClick={() => void respond(c.id, "DECLINE")} disabled={busy !== null}>
                  <XIcon />
                  Decline
                </Button>
                <p className="w-full text-xs text-muted-foreground">
                  If you accept, you&apos;ll see each other&apos;s phone numbers.
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
