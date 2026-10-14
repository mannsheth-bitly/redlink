import type { Role } from "@red-link/shared/domain/constants";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Navigation per role (spec Section 8). Only pages that exist are listed;
 * items are added here as each phase builds its pages.
 */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  DONOR: [
    { href: "/donor", label: "Home" },
    { href: "/donor/contacts", label: "Contacts" },
    { href: "/donor/history", label: "History" },
    { href: "/donor/profile", label: "Profile" },
  ],
  RECEIVER: [
    { href: "/receiver", label: "Find donors" },
    { href: "/receiver/requests", label: "My requests" },
    { href: "/receiver/contacts", label: "Contacts" },
  ],
  HOSPITAL: [
    { href: "/hospital", label: "Dashboard" },
    { href: "/hospital/requests/new", label: "New request" },
    { href: "/hospital/search", label: "Find donors" },
    { href: "/hospital/donations", label: "Donations" },
  ],
  EMERGENCY: [
    { href: "/emergency", label: "Dashboard" },
    { href: "/emergency/requests/new", label: "New request" },
    { href: "/emergency/search", label: "Find donors" },
    { href: "/emergency/donations", label: "Donations" },
  ],
  BLOOD_BANK: [
    { href: "/bloodbank", label: "Inventory" },
    { href: "/bloodbank/requests", label: "Requests" },
    { href: "/bloodbank/camps", label: "Camps" },
    { href: "/bloodbank/donations", label: "Walk-ins" },
  ],
  ADMIN: [
    { href: "/admin", label: "Analytics" },
    { href: "/admin/verifications", label: "Verifications" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/requests", label: "Requests" },
    { href: "/admin/flags", label: "Flags" },
    { href: "/admin/search", label: "Find donors" },
  ],
};
