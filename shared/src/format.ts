// Display helpers that work on both server and client. Times are shown in India Standard Time.
const TZ = "Asia/Kolkata";

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string | Date, now = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "in 3 h", "in 2 days", or "overdue" */
export function timeUntil(iso: string | Date, now = new Date()): string {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "overdue";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Value for <input type="date"> from a stored UTC-midnight date. */
export function toDateInputValue(iso: string | Date | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}
