import { USER_STATUS_LABEL } from "@/lib/admin";
import { cn } from "@/lib/utils";

export function UserStatusBadge({ status }: { status: string }) {
  const s = USER_STATUS_LABEL[status] ?? { label: status, className: "bg-muted" };
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", s.className)}>{s.label}</span>;
}
