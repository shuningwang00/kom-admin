"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PEOPLE_NAV_ITEMS, type PeopleTabsConfig } from "@/lib/people/nav";

export default function PeopleTabs({ tabs }: { tabs: PeopleTabsConfig }) {
  const pathname = usePathname();
  const visible = PEOPLE_NAV_ITEMS.filter((t) => tabs[t.tabKey]);

  return (
    <nav className="flex flex-wrap gap-6 border-b border-zinc-200">
      {visible.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "-mb-px border-b-2 border-orange-600 pb-3 text-sm font-medium text-orange-600"
                : "border-b-2 border-transparent pb-3 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
