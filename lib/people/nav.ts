export type PeopleTabsConfig = {
  timeOff: boolean;
  availability: boolean;
  adminRoster: boolean;
  payroll: boolean;
};

export const PEOPLE_NAV_ITEMS = [
  {
    href: "/people/time-off",
    label: "Time off",
    tabKey: "timeOff" as const,
    tutorNeedsViewPeople: true,
  },
  {
    href: "/people/availability",
    label: "Availability",
    tabKey: "availability" as const,
    tutorNeedsViewPeople: false,
  },
  {
    href: "/people/admin-roster",
    label: "Admin roster",
    tabKey: "adminRoster" as const,
    tutorNeedsViewPeople: false,
  },
  {
    href: "/people/payroll",
    label: "Payroll",
    tabKey: "payroll" as const,
    tutorNeedsViewPeople: true,
  },
] as const;

export function filterPeopleNavItems(
  tabs: PeopleTabsConfig | undefined,
  opts: {
    role: "owner" | "staff" | "tutor" | undefined;
    tutorCanViewPeople: boolean;
  },
): typeof PEOPLE_NAV_ITEMS[number][] {
  if (!tabs || !opts.role) return [];
  return PEOPLE_NAV_ITEMS.filter((item) => {
    if (!tabs[item.tabKey]) return false;
    if (opts.role === "tutor" && item.tutorNeedsViewPeople && !opts.tutorCanViewPeople) {
      return false;
    }
    return true;
  });
}
