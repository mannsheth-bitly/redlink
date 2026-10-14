import { BellIcon, SirenIcon, XIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useRefresh } from "@/lib/refresh";
import { buttonVariants } from "@/components/ui/button-variants";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NOTIFICATION_POLL_MS, NOTIFICATION_POLL_URGENT_MS } from "@red-link/shared/domain/constants";
import { timeAgo } from "@red-link/shared/format";
import type { NotificationItem, NotificationsResponse } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

interface NotificationsContextValue {
  data: NotificationsResponse | null;
  markRead: (ids: string[] | "all") => Promise<void>;
  open: (n: NotificationItem) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}

/** Short two-tone alert generated with the Web Audio API (no audio file needed, works offline). */
function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    // Stays pending if the browser blocks audio until the user clicks; that's fine, the banner still shows.
    ctx.resume().catch(() => {});
    const tone = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.3);
    };
    tone(880, 0);
    tone(660, 0.3);
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    // Browsers may block audio before the user interacts with the page; the banner still shows.
  }
}

const SOUNDED_KEY = "redlink:sounded";

function loadSounded(): Set<string> {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(SOUNDED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Polls GET /api/notifications every 10 s (5 s while an URGENT/CRITICAL alert is unread),
 * plays a sound once per new urgent alert, and refreshes server-rendered pages when
 * something new arrives so feeds and donor lists stay current (spec Section 10).
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const latestId = useRef<string | null>(null);
  const sounded = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return null;
      const next: NotificationsResponse = await res.json();
      setData(next);

      sounded.current ??= loadSounded();
      const fresh = next.urgent.filter((n) => !sounded.current!.has(n.id));
      if (fresh.length > 0) {
        playAlertSound();
        fresh.forEach((n) => sounded.current!.add(n.id));
        try {
          sessionStorage.setItem(SOUNDED_KEY, JSON.stringify([...sounded.current].slice(-200)));
        } catch {
          // storage unavailable: worst case the sound plays again after a reload
        }
      }

      const newest = next.notifications[0]?.id ?? null;
      if (latestId.current !== null && newest !== latestId.current) refresh();
      latestId.current = newest;
      return next;
    } catch {
      return null; // offline: keep the last data and try again next tick
    }
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = async () => {
      const next = await load();
      if (cancelled) return;
      const delay = next && next.urgent.length > 0 ? NOTIFICATION_POLL_URGENT_MS : NOTIFICATION_POLL_MS;
      timer = setTimeout(tick, delay);
    };
    void tick();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const markRead = useCallback(
    async (ids: string[] | "all") => {
      setData((d) =>
        d
          ? {
              notifications: d.notifications.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)),
              urgent: ids === "all" ? [] : d.urgent.filter((n) => !ids.includes(n.id)),
              unreadCount: ids === "all" ? 0 : Math.max(0, d.unreadCount - d.notifications.filter((n) => !n.read && ids.includes(n.id)).length),
            }
          : d,
      );
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      } finally {
        void load();
      }
    },
    [load],
  );

  const open = useCallback(
    (n: NotificationItem) => {
      if (!n.read) void markRead([n.id]);
      if (n.link) navigate(n.link);
    },
    [markRead, navigate],
  );

  return <NotificationsContext.Provider value={{ data, markRead, open }}>{children}</NotificationsContext.Provider>;
}

export function NotificationBell() {
  const { data, markRead, open } = useNotifications();
  const unread = data?.unreadCount ?? 0;
  const items = data?.notifications.slice(0, 8) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => void markRead("all")}>
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {data ? "You're all caught up." : "Loading…"}
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto p-1">
            {items.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => open(n)} className="flex-col items-start gap-0.5 px-2 py-2">
                <span className="flex w-full items-center gap-1.5">
                  {!n.read ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                  {n.priority === "CRITICAL" || n.priority === "URGENT" ? (
                    <SirenIcon className="size-3.5 text-primary" aria-hidden="true" />
                  ) : null}
                  <span className={cn("line-clamp-1 text-sm", !n.read && "font-semibold")}>{n.title}</span>
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <div className="border-t p-1">
          <Link to="/notifications" className="block rounded-md px-2 py-1.5 text-center text-sm text-primary hover:bg-muted">
            See all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sticky red banner for unread URGENT / CRITICAL notifications (spec Section 10). */
export function UrgentBanner() {
  const { data, markRead, open } = useNotifications();
  const top = data?.urgent[0];
  if (!top) return null;
  const more = (data?.urgent.length ?? 1) - 1;
  return (
    <div role="alert" className="sticky top-14 z-30 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <SirenIcon className="size-5 shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{top.title}</p>
          <p className="truncate text-xs opacity-90">
            {top.body}
            {more > 0 ? ` (+${more} more)` : ""}
          </p>
        </div>
        {top.link ? (
          <button
            type="button"
            onClick={() => open(top)}
            className="shrink-0 rounded-md bg-primary-foreground px-3 py-1.5 text-sm font-semibold text-primary hover:opacity-90"
          >
            View
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void markRead([top.id])}
          className="shrink-0 rounded-md p-1.5 hover:bg-primary-foreground/15"
          aria-label="Dismiss alert"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Full list for /notifications. */
export function NotificationsList() {
  const { data, markRead, open } = useNotifications();
  if (!data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (data.notifications.length === 0) {
    return <p className="rounded-lg border p-8 text-center text-muted-foreground">No notifications yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {data.unreadCount > 0 ? (
        <button type="button" className="self-end text-sm text-primary hover:underline" onClick={() => void markRead("all")}>
          Mark all read
        </button>
      ) : null}
      <ul className="flex flex-col divide-y rounded-lg border">
        {data.notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              className={cn("flex w-full flex-col items-start gap-0.5 p-3 text-left hover:bg-muted", !n.read && "bg-primary/5")}
            >
              <span className="flex items-center gap-1.5">
                {!n.read ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}
                <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
              </span>
              <span className="text-sm text-muted-foreground">{n.body}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
