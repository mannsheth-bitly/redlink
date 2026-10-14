import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { NavLinks } from "@/components/shared/nav-links";
import { NotificationBell, NotificationsProvider, UrgentBanner } from "@/components/shared/notifications";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_HOME, ROLE_LABEL, type Role } from "@red-link/shared/domain/constants";
import type { NavItem } from "@/lib/nav";

interface ShellUser {
  name: string;
  role: Role;
  institutionName?: string | null;
}

/** Layout for every logged-in page: header with role navigation, user info and logout. */
export function AppShell({
  user,
  navItems,
  children,
}: {
  user: ShellUser;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const displayName = user.institutionName ?? user.name;
  // Longer menus (admin) switch to the inline nav at a wider breakpoint so the header doesn't overflow.
  const wide = navItems.length > 4;
  return (
    <NotificationsProvider>
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Logo href={ROLE_HOME[user.role]} />
          <NavLinks items={navItems} className={wide ? "ml-4 hidden items-center gap-1 lg:flex" : "ml-4 hidden items-center gap-1 md:flex"} />
          <div className="ml-auto flex items-center gap-1">
            <div className="mr-2 hidden text-right leading-tight sm:block">
              <p className="max-w-48 truncate text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
            <NotificationBell />
            <ThemeToggle />
            <LogoutButton className={wide ? "hidden lg:inline-flex" : "hidden md:inline-flex"} />
            <Sheet>
              <SheetTrigger
                className={buttonVariants({ variant: "ghost", size: "icon", className: wide ? "lg:hidden" : "md:hidden" })}
                aria-label="Open menu"
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>{displayName}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]}</p>
                </SheetHeader>
                <NavLinks items={navItems} className="flex flex-col gap-1 px-2" itemClassName="text-base" />
                <div className="mt-auto p-4">
                  <LogoutButton className="w-full" />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <UrgentBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
    </NotificationsProvider>
  );
}
