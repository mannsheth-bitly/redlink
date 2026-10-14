import { Navigate, Outlet, useLocation } from "react-router";
import { AccountStatusScreen } from "@/components/shared/account-status-screen";
import { AppShell } from "@/components/shared/app-shell";
import { PageLoading } from "@/components/shared/page-state";
import { isRole, ROLE_HOME, type Role } from "@red-link/shared/domain/constants";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/nav";

function LoginRedirect() {
  const { pathname, search } = useLocation();
  const { loggedOut } = useAuth();
  // After a deliberate logout, go to a plain login page; otherwise remember where the visitor was going.
  return <Navigate to={loggedOut ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`} replace />;
}

/**
 * A role's pages: logged out → /login, wrong role → own dashboard (spec Phase 1),
 * pending / rejected / suspended → status screen (spec 7.C), otherwise the app shell.
 */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (user === undefined) return <PageLoading />;
  if (!user || !isRole(user.role)) return <LoginRedirect />;
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;
  if (user.status === "PENDING_VERIFICATION" || user.status === "REJECTED" || user.status === "SUSPENDED") {
    return (
      <AccountStatusScreen
        status={user.status}
        orgName={user.institution?.orgName}
        rejectionNote={user.status === "REJECTED" ? user.institution?.rejectionNote : null}
      />
    );
  }
  return (
    <AppShell user={{ name: user.name, role: user.role, institutionName: user.institution?.orgName }} navItems={NAV_ITEMS[user.role]}>
      <Outlet />
    </AppShell>
  );
}

/** Pages for any logged-in user (e.g. /notifications), with that user's own navigation. */
export function RequireUser() {
  const { user } = useAuth();
  if (user === undefined) return <PageLoading />;
  if (!user || !isRole(user.role)) return <LoginRedirect />;
  return (
    <AppShell user={{ name: user.name, role: user.role, institutionName: user.institution?.orgName }} navItems={NAV_ITEMS[user.role]}>
      <Outlet />
    </AppShell>
  );
}

/** /login and /signup: a logged-in user goes straight to their dashboard. */
export function GuestOnly() {
  const { user } = useAuth();
  if (user === undefined) return <PageLoading />;
  if (user && isRole(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
