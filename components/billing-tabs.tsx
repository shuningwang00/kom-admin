"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/billing", label: "Dashboard" },
  { href: "/billing/invoices", label: "Invoices" },
  { href: "/billing/rates", label: "Rates" },
];

export default function BillingTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-6 border-b border-zinc-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/billing" && pathname.startsWith(tab.href));
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
