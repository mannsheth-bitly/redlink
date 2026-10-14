import { Link } from "react-router";
import { useLocation } from "react-router";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function NavLinks({
  items,
  className,
  itemClassName,
}: {
  items: NavItem[];
  className?: string;
  itemClassName?: string;
}) {
  const { pathname } = useLocation();
  // The dashboard link (first item) is only active on exact match; others also match sub-pages.
  const isActive = (href: string, index: number) =>
    index === 0 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Main" className={className}>
      {items.map((item, i) => {
        const active = isActive(item.href, i);
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              active ? "bg-muted text-foreground" : "text-muted-foreground",
              itemClassName,
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
