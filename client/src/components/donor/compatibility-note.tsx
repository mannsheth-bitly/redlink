import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const show = (g: string) => g.replace("-", "−");

/**
 * Explains why a donor was matched to a different blood group (e.g. O+ donor, A+ patient).
 * Renders nothing for an exact match.
 */
export function CompatibilityNote({
  donorGroup,
  patientGroup,
  className,
}: {
  donorGroup: string;
  patientGroup: string;
  className?: string;
}) {
  if (donorGroup === patientGroup) return null;
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <InfoIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      Your {show(donorGroup)} blood is compatible with {show(patientGroup)} patients.
    </p>
  );
}
