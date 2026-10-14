import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GuestOnly, RequireRole, RequireUser } from "@/components/shared/guards";
import { PageLoading } from "@/components/shared/page-state";
import { PublicLayout } from "@/components/shared/public-header";

// Each page is its own chunk, loaded when first visited.
const Landing = lazy(() => import("@/pages/public/landing"));
const About = lazy(() => import("@/pages/public/about"));
const Login = lazy(() => import("@/pages/public/login"));
const Signup = lazy(() => import("@/pages/public/signup"));
const NotFound = lazy(() => import("@/pages/public/not-found"));
const Notifications = lazy(() => import("@/pages/notifications"));

const DonorHome = lazy(() => import("@/pages/donor/home"));
const DonorRequest = lazy(() => import("@/pages/donor/request"));
const DonorContacts = lazy(() => import("@/pages/donor/contacts"));
const DonorHistory = lazy(() => import("@/pages/donor/history"));
const DonorProfile = lazy(() => import("@/pages/donor/profile"));

const FindDonors = lazy(() => import("@/pages/shared/find-donors"));
const Dashboard = lazy(() => import("@/pages/shared/dashboard"));
const NewRequest = lazy(() => import("@/pages/shared/new-request"));
const RequestDetail = lazy(() => import("@/pages/shared/request-detail"));
const Donations = lazy(() => import("@/pages/shared/donations"));
const ReceiverContacts = lazy(() => import("@/pages/receiver/contacts"));
const EmergencyDashboard = lazy(() => import("@/pages/emergency/dashboard"));

const Inventory = lazy(() => import("@/pages/bloodbank/inventory"));
const SupplyRequestsPage = lazy(() => import("@/pages/bloodbank/requests"));
const Camps = lazy(() => import("@/pages/bloodbank/camps"));
const WalkIns = lazy(() => import("@/pages/bloodbank/walk-ins"));

const AdminHome = lazy(() => import("@/pages/admin/home"));
const AdminVerifications = lazy(() => import("@/pages/admin/verifications"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminRequests = lazy(() => import("@/pages/admin/requests"));
const AdminFlags = lazy(() => import("@/pages/admin/flags"));

/** Spec Section 8 pages. Role guards mirror the server's checks (the API enforces them too). */
export function App() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="about" element={<About />} />
          <Route element={<GuestOnly />}>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
          </Route>
        </Route>

        <Route element={<RequireUser />}>
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="donor" element={<RequireRole role="DONOR" />}>
          <Route index element={<DonorHome />} />
          <Route path="requests/:id" element={<DonorRequest />} />
          <Route path="contacts" element={<DonorContacts />} />
          <Route path="history" element={<DonorHistory />} />
          <Route path="profile" element={<DonorProfile />} />
        </Route>

        <Route path="receiver" element={<RequireRole role="RECEIVER" />}>
          <Route index element={<FindDonors allowContact />} />
          <Route path="requests" element={<Dashboard base="/receiver" title="My requests" />} />
          <Route path="requests/new" element={<NewRequest />} />
          <Route path="requests/:id" element={<RequestDetail back="/receiver/requests" />} />
          <Route path="contacts" element={<ReceiverContacts />} />
        </Route>

        <Route path="hospital" element={<RequireRole role="HOSPITAL" />}>
          <Route index element={<Dashboard base="/hospital" title="Hospital dashboard" />} />
          <Route path="requests/new" element={<NewRequest />} />
          <Route path="requests/:id" element={<RequestDetail back="/hospital" />} />
          <Route path="search" element={<FindDonors allowContact={false} />} />
          <Route path="donations" element={<Donations base="/hospital" />} />
        </Route>

        <Route path="emergency" element={<RequireRole role="EMERGENCY" />}>
          <Route index element={<EmergencyDashboard />} />
          <Route path="requests/new" element={<NewRequest />} />
          <Route path="requests/:id" element={<RequestDetail back="/emergency" />} />
          <Route path="search" element={<FindDonors allowContact={false} />} />
          <Route path="donations" element={<Donations base="/emergency" />} />
        </Route>

        <Route path="bloodbank" element={<RequireRole role="BLOOD_BANK" />}>
          <Route index element={<Inventory />} />
          <Route path="requests" element={<SupplyRequestsPage />} />
          <Route path="camps" element={<Camps />} />
          <Route path="donations" element={<WalkIns />} />
        </Route>

        <Route path="admin" element={<RequireRole role="ADMIN" />}>
          <Route index element={<AdminHome />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="requests/:id" element={<RequestDetail back="/admin/requests" />} />
          <Route path="flags" element={<AdminFlags />} />
          <Route path="search" element={<FindDonors allowContact={false} admin />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
