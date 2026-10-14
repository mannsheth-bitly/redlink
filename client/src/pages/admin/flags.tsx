import { BanIcon, CheckIcon, FlagIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { RequestStatusBadge } from "@/components/shared/badges";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FlagItem } from "@red-link/shared/api";
import { ROLE_LABEL, type Role } from "@red-link/shared/domain/constants";
import { formatDateTime, timeAgo } from "@red-link/shared/format";
import { describeSummary, SUSPEND_EFFECT, type SuspensionSummary } from "@/lib/admin";
import { api, ApiError, useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";
import { useRefresh } from "@/lib/refresh";
import { cn } from "@/lib/utils";

type Action = "RESOLVE" | "DISMISS" | "SUSPEND_AND_RESOLVE";

const ACTION_TEXT: Record<Action, { title: string; button: string; done: string }> = {
  RESOLVE: { title: "Resolve this report?", button: "Resolve", done: "Report resolved." },
  DISMISS: { title: "Dismiss this report?", button: "Dismiss", done: "Report dismissed." },
  SUSPEND_AND_RESOLVE: { title: "Suspend the account and resolve?", button: "Suspend & resolve", done: "Account suspended and report resolved." },
};

const FLAG_STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-primary/10 text-primary" },
  RESOLVED: { label: "Resolved", className: "bg-success/15 text-success" },
  DISMISSED: { label: "Dismissed", className: "bg-muted text-muted-foreground" },
};

const roleName = (role: string) => ROLE_LABEL[role as Role] ?? role;

/** Spec 8 /admin/flags. Owner decision: resolve / dismiss / suspend & resolve, optional note, reporter notified. */
export default function FlagsPage() {
  usePageTitle("Flags");
  const refresh = useRefresh();
  const [tab, setTab] = useState("OPEN");
  const { data, error, reload } = useApi<{ flags: FlagItem[] }>(`/api/admin/flags${tab === "ALL" ? "" : `?status=${tab}`}`);
  const [pending, setPending] = useState<{ flag: FlagItem; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function review() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await api<{ status: string; summary: SuspensionSummary | null }>("/api/admin/flags", {
        method: "PATCH",
        body: { flagId: pending.flag.id, action: pending.action, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      toast.success(`${ACTION_TEXT[pending.action].done}${describeSummary(res.summary)} The reporter has been told.`);
      setPending(null);
      setNote("");
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save the review.");
    } finally {
      setBusy(false);
    }
  }

  const flags = data?.flags ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flags</h1>
        <p className="text-muted-foreground">Reports from users about other users or requests.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
          <TabsTrigger value="DISMISSED">Dismissed</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? <PageError error={error} onRetry={reload} /> : null}
      {!data && !error ? <SectionLoading /> : null}

      {data && flags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <FlagIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">{tab === "OPEN" ? "No open flags" : "Nothing here"}</p>
          <p className="text-sm text-muted-foreground">Reports that users send will appear here.</p>
        </div>
      ) : null}

      {flags.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {flags.map((f) => {
            const s = FLAG_STATUS[f.status] ?? { label: f.status, className: "bg-muted" };
            const canSuspend = f.target !== null && f.target.status === "ACTIVE" && f.target.role !== "ADMIN";
            return (
              <li key={f.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.className)}>{s.label}</span>
                  <span className="text-sm">
                    Reported by <strong>{f.reporter.name}</strong>{" "}
                    <span className="text-muted-foreground">({roleName(f.reporter.role)})</span>
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(f.createdAt)}>
                    {timeAgo(f.createdAt)}
                  </span>
                </div>

                <p className="rounded-lg bg-muted/60 p-3 text-sm">&ldquo;{f.reason}&rdquo;</p>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {f.target ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Reported user</dt>
                      <dd className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{f.target.name}</span>
                        <span className="text-muted-foreground">({roleName(f.target.role)})</span>
                        <UserStatusBadge status={f.target.status} />
                      </dd>
                    </div>
                  ) : null}
                  {f.request ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Request</dt>
                      <dd className="flex flex-wrap items-center gap-1.5">
                        <Link to={`/admin/requests/${f.request.id}`} className="font-medium underline-offset-4 hover:underline">
                          {f.request.bloodGroup.replace("-", "−")} at {f.request.hospitalName}
                        </Link>
                        <RequestStatusBadge status={f.request.status} />
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {f.status === "OPEN" ? (
                  <div className="flex flex-wrap gap-2">
                    {canSuspend ? (
                      <Button variant="destructive" size="sm" onClick={() => setPending({ flag: f, action: "SUSPEND_AND_RESOLVE" })}>
                        <BanIcon />
                        Suspend user &amp; resolve
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => setPending({ flag: f, action: "RESOLVE" })}>
                      <CheckIcon />
                      Resolve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPending({ flag: f, action: "DISMISS" })}>
                      <XIcon />
                      Dismiss
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {s.label} {f.resolvedAt ? timeAgo(f.resolvedAt) : ""}
                    {f.resolutionNote ? ` · Note: “${f.resolutionNote}”` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? ACTION_TEXT[pending.action].title : ""}</DialogTitle>
            <DialogDescription>
              {pending?.action === "SUSPEND_AND_RESOLVE" && pending.flag.target
                ? `${pending.flag.target.name} will be logged out and blocked until reactivated. ${SUSPEND_EFFECT[pending.flag.target.role as Role] ?? ""}`
                : "The reporter gets a notification with the outcome."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="flag-note">Note to the reporter (optional)</Label>
            <Textarea id="flag-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant={pending?.action === "SUSPEND_AND_RESOLVE" ? "destructive" : "default"} onClick={() => void review()} disabled={busy}>
              {busy ? "Saving…" : pending ? ACTION_TEXT[pending.action].button : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
