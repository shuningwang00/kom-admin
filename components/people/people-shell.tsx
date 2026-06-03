"use client";

import { useEffect, useState } from "react";
import PeopleTabs from "@/components/people/people-tabs";

type PeopleTabsConfig = {
  timeOff: boolean;
  availability: boolean;
  adminRoster: boolean;
  clock: boolean;
  payroll: boolean;
  claims: boolean;
};

const DEFAULT_TABS: PeopleTabsConfig = {
  timeOff: true,
  availability: false,
  adminRoster: false,
  clock: true,
  payroll: true,
  claims: true,
};

export default function PeopleShell({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<PeopleTabsConfig>(DEFAULT_TABS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.peopleTabs) setTabs(me.peopleTabs as PeopleTabsConfig);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <PeopleTabs tabs={tabs} />
      {children}
    </div>
  );
}
