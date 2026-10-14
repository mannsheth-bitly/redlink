import { Link } from "react-router";
import { cn } from "@/lib/utils";

/** Blood drop with a chain link inside (spec Section 11). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <path
        d="M16 2.5c-.6.7-10 11.5-10 18.2a10 10 0 0 0 20 0C26 14 16.6 3.2 16 2.5Z"
        fill="#B91C1C"
      />
      <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round">
        <rect x="9" y="20" width="9" height="5" rx="2.5" transform="rotate(-45 13.5 22.5)" />
        <rect x="14" y="15" width="9" height="5" rx="2.5" transform="rotate(-45 18.5 17.5)" />
      </g>
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link to={href} className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">
        Red <span className="text-primary">Link</span>
      </span>
    </Link>
  );
}
