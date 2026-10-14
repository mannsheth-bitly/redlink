import { BanIcon, FlagIcon, MailIcon, PhoneIcon, RotateCcwIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AdminUserRow } from "@red-link/shared/api";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { ROLE_LABEL, ROLES, USER_STATUSES } from "@red-link/shared/domain/constants";
import { formatDay } from "@red-link/shared/format";
import { describeSummary, SUSPEND_EFFECT, USER_STATUS_LABEL as STATUS, type SuspensionSummary } from "@/lib/admin";
import { api, ApiError, useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";
import { useRefresh } from "@/lib/refresh";

interface SuspendResult {
  status: string;
  summary: SuspensionSummary | null;
}

/** Spec 8 /admin/users: search, suspend / reactivate. */
export default function UsersPage() {
  usePageTitle("Users");
  const me = useUser();
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<{ user: AdminUserRow; action: "SUSPEND" | "REACTIVATE" } | null>(null);
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) });
  const { data, error, reload, loading } = useApi<{ users: AdminUserRow[]; total: number; limit: number }>(`/api/admin/users?${params}`);

  async function apply() {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await api<SuspendResult>(`/api/admin/users/${confirm.user.id}`, { method: "PATCH", body: { action: confirm.action } });
      const name = confirm.user.orgName ?? confirm.user.name;
      toast.success(confirm.action === "SUSPEND" ? `${name} suspended.${describeSummary(res.summary)}` : `${name} reactivated.`);
      setConfirm(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Search every account, and suspend or reactivate them.</p>
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-q">Name, email, phone or organisation</Label>
          <Input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Rahul or 90000" maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-role">Role</Label>
          <NativeSelect id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-status">Status</Label>
          <NativeSelect id="user-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS[s]?.label ?? s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">
          <SearchIcon />
          Search
        </Button>
      </form>

      {error ? <PageError error={error} onRetry={reload} /> : null}
      {!data && !error ? <SectionLoading /> : null}

      {data ? (
        <section aria-labelledby="users-heading" aria-busy={loading} className="flex flex-col gap-3">
          <h2 id="users-heading" className="text-sm font-medium text-muted-foreground">
            {data.total === 0
              ? "No accounts match"
              : data.total > data.users.length
                ? `Showing the newest ${data.users.length} of ${data.total} accounts. Narrow the search to see others.`
                : `${data.total} account${data.total === 1 ? "" : "s"}`}
          </h2>
          {data.users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <UsersIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">No accounts found</p>
              <p className="text-sm text-muted-foreground">Try a different name, or clear the filters.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
                  {u.bloodGroup ? <BloodGroupPill group={u.bloodGroup} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {u.orgName ?? u.name}
                      {u.bloodGroupVerified ? <VerifiedBadge /> : null}
                      <UserStatusBadge status={u.status} />
                      {u.openFlags > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                          <FlagIcon className="size-3" aria-hidden="true" />
                          {u.openFlags} open flag{u.openFlags === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      <span>{ROLE_LABEL[u.role]}</span>
                      {u.orgName ? <span>Contact: {u.name}</span> : null}
                      <span className="flex items-center gap-1 break-all">
                        <MailIcon className="size-3.5" aria-hidden="true" />
                        {u.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <PhoneIcon className="size-3.5" aria-hidden="true" />
                        {u.phone}
                      </span>
                      {u.city ? <span>{u.city}</span> : null}
                      <span>Joined {formatDay(u.createdAt)}</span>
                    </p>
                  </div>
                  {u.role !== "ADMIN" && u.id !== me.id && u.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Suspend ${u.orgName ?? u.name}`}
                      onClick={() => setConfirm({ user: u, action: "SUSPEND" })}
                    >
                      <BanIcon />
                      Suspend
                    </Button>
                  ) : null}
                  {u.status === "SUSPENDED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Reactivate ${u.orgName ?? u.name}`}
                      onClick={() => setConfirm({ user: u, action: "REACTIVATE" })}
                    >
                      <RotateCcwIcon />
                      Reactivate
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "SUSPEND" ? "Suspend" : "Reactivate"} {confirm?.user.orgName ?? confirm?.user.name}?
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "SUSPEND"
                ? `They'll be logged out and can't log in again until reactivated. ${SUSPEND_EFFECT[confirm.user.role] ?? ""}`
                : "They can log in and use Red Link again. Requests cancelled when they were suspended stay cancelled."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant={confirm?.action === "SUSPEND" ? "destructive" : "default"} onClick={() => void apply()} disabled={busy}>
              {busy ? "Saving…" : confirm?.action === "SUSPEND" ? "Suspend account" : "Reactivate account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
