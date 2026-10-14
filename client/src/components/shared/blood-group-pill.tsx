import { cn } from "@/lib/utils";

/** Bold blood-group pill, e.g. "O−" (spec Section 11). Uses a real minus sign for display. */
export function BloodGroupPill({ group, className }: { group: string; className?: string }) {
  const display = group.replace("-", "−");
  const label = `Blood group ${group.replace("-", " negative").replace("+", " positive")}`;
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-w-11 items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-sm font-extrabold text-primary-foreground",
        className,
      )}
    >
      {display}
    </span>
  );
}
