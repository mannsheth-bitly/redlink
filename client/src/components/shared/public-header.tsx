import { Link, Outlet } from "react-router";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { isRole, ROLE_HOME } from "@red-link/shared/domain/constants";
import { useAuth } from "@/lib/auth";

export function PublicHeader() {
  const { user } = useAuth();
  const home = user && isRole(user.role) ? ROLE_HOME[user.role] : null;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Logo />
        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          <Link to="/about" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
            About
          </Link>
          <ThemeToggle />
          {home ? (
            <Link to={home} className={buttonVariants()}>
              My dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
                Log in
              </Link>
              <Link to="/signup" className={buttonVariants()}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Red Link — connecting blood donors with people who need them.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <Link to="/signup" className="hover:text-foreground">
            Become a donor
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** Layout for the public pages (landing, about, login, signup, 404). */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
