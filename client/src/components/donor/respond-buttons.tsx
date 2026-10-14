import { CheckIcon, XIcon } from "lucide-react";
import { useRefresh } from "@/lib/refresh";
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

/** Accept / Decline, and withdraw after accepting (owner decision: allowed until the donation is recorded). */
export function RespondButtons({
  matchId,
  status,
  canAccept,
  cannotAcceptReason,
}: {
  matchId: string;
  status: string;
  canAccept: boolean;
  cannotAcceptReason: string | null;
}) {
  const refresh = useRefresh();
  const [pending, setPending] = useState<"ACCEPT" | "DECLINE" | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function respond(action: "ACCEPT" | "DECLINE") {
    setPending(action);
    try {
      const res = await fetch(`/api/matches/${matchId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save your response.");
        return;
      }
      if (action === "ACCEPT") toast.success("Thank you! The hospital can now see your phone number.");
      else toast.success(status === "ACCEPTED" ? "You've withdrawn from this request." : "Request declined.");
      setConfirmWithdraw(false);
      refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setPending(null);
    }
  }

  if (status === "ACCEPTED") {
    return (
      <>
        <Button variant="outline" size="lg" className="h-11" onClick={() => setConfirmWithdraw(true)}>
          I can no longer donate
        </Button>
        <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw from this request?</DialogTitle>
              <DialogDescription>
                The hospital will be told you can no longer donate, so they can contact other donors.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Keep my acceptance</DialogClose>
              <Button variant="destructive" onClick={() => void respond("DECLINE")} disabled={pending !== null}>
                {pending ? "Withdrawing…" : "Withdraw"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-12 text-base"
          onClick={() => void respond("ACCEPT")}
          disabled={!canAccept || pending !== null}
          aria-describedby={!canAccept && cannotAcceptReason ? "cannot-accept" : undefined}
        >
          <CheckIcon />
          {pending === "ACCEPT" ? "Accepting…" : status === "DECLINED" ? "Accept instead" : "Accept"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-base"
          onClick={() => void respond("DECLINE")}
          disabled={status === "DECLINED" || pending !== null}
        >
          <XIcon />
          {pending === "DECLINE" ? "Declining…" : status === "DECLINED" ? "Declined" : "Decline"}
        </Button>
      </div>
      {!canAccept && cannotAcceptReason ? (
        <p id="cannot-accept" className="text-sm text-warning">
          {cannotAcceptReason}
        </p>
      ) : null}
    </div>
  );
}
