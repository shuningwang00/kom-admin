"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  filterPeopleNavItems,
  type PeopleTabsConfig,
} from "@/lib/people/nav";

const MOBILE_MAX = 767;
const HEADER_ROW =
  "flex h-14 shrink-0 items-center border-b border-zinc-800";

type AppPermissions = {
  tutor: { viewCalendar: boolean; viewPeople: boolean; viewByDay: boolean; viewStudents: boolean };
  staff: { generateSessions: boolean };
};

type MeResponse = {
  user: {
    email: string;
    role: string;
    roleLabel?: string;
    displayName: string;
  } | null;
  isOwner: boolean;
  permissions?: AppPermissions;
  peopleTabs?: PeopleTabsConfig;
};

type HealthResponse = {
  ok: boolean;
  db: {
    configured: boolean;
    connected: boolean;
    studentCount: number;
    error: string | null;
  };
};

// Module-level cache — persists across re-mounts within a browser session.
let _me: MeResponse | null = null;
let _health: HealthResponse | null = null;

type NavItem = {
  href: string;
  label: string;
  roles: Array<"owner" | "staff" | "tutor" | "relief_tutor">;
  /** If set, only shown when the role's permission flag is true. */
  permission?: { role: "tutor" | "staff"; flag: keyof AppPermissions["tutor"] | keyof AppPermissions["staff"] };
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/calendar",
    label: "Calendar",
    roles: ["owner", "staff", "tutor", "relief_tutor"],
    permission: { role: "tutor", flag: "viewCalendar" },
  },
  { href: "/attendance/tutor", label: "My classes", roles: ["tutor", "relief_tutor"] },
  { href: "/attendance", label: "By day", roles: ["tutor"], permission: { role: "tutor", flag: "viewByDay" } },
  { href: "/attendance", label: "Attendance", roles: ["owner", "staff"] },
  { href: "/makeup", label: "Makeup", roles: ["owner", "staff"] },
  { href: "/trials", label: "Trials", roles: ["owner", "staff"] },
  { href: "/programmes", label: "Programmes", roles: ["owner", "staff"] },
  { href: "/students", label: "Students", roles: ["owner", "staff", "tutor"], permission: { role: "tutor", flag: "viewStudents" } },
  { href: "/classes", label: "Classes", roles: ["owner"] },
  { href: "/enrollments", label: "Enrollments", roles: ["owner", "staff"] },
  { href: "/billing", label: "Billing", roles: ["owner", "staff"] },
];

function MenuIcon() {
  return (
    <svg
      className="h-6 w-6 text-white"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function navLinkActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== "/attendance" && pathname.startsWith(`${href}/`)) ||
    (href === "/attendance" &&
      pathname.startsWith("/attendance") &&
      !pathname.startsWith("/attendance/tutor"))
  );
}

const navLinkBase =
  "block rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium";

function NavLink({
  href,
  label,
  onNavigate,
  nested = false,
  badge,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
  /** Indented item under a sidebar group (e.g. People). */
  nested?: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = navLinkActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        active
          ? `${navLinkBase} flex items-center justify-between border-orange-500 bg-zinc-800 text-orange-400 ${
              nested ? "ml-2 border-l-zinc-500" : ""
            }`
          : `${navLinkBase} flex items-center justify-between text-zinc-400 hover:bg-zinc-800 hover:text-white ${
              nested
                ? "ml-2 border-l-zinc-600 text-zinc-500 hover:text-zinc-200"
                : "border-transparent"
            }`
      }
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-2 shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function PeopleChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleNavGroup({
  items,
  onNavigate,
  rosterAlertCount = 0,
}: {
  items: Array<{ href: string; label: string }>;
  onNavigate?: () => void;
  rosterAlertCount?: number;
}) {
  const pathname = usePathname();
  const inPeople = pathname.startsWith("/people");
  const groupActive = items.some((item) => navLinkActive(pathname, item.href));
  const [open, setOpen] = useState(inPeople);

  useEffect(() => {
    setOpen(inPeople);
  }, [inPeople]);

  return (
    <div
      className={`mt-1 space-y-0.5 rounded-lg border py-1 ${
        groupActive || open
          ? "border-zinc-700 bg-zinc-800/40"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (!inPeople) setOpen((v) => !v);
        }}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold ${
          groupActive
            ? "text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
        }`}
      >
        <span>Human Resources</span>
        <span className="flex items-center gap-1.5">
          {!open && rosterAlertCount > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {rosterAlertCount}
            </span>
          )}
          <PeopleChevron open={open} />
        </span>
      </button>
      {open &&
        items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            nested
            onNavigate={onNavigate}
            badge={item.href === "/people/admin-roster" ? rosterAlertCount : undefined}
          />
        ))}
    </div>
  );
}

const SETTINGS_ITEMS = [
  { href: "/settings/manageaccess", label: "Manage access" },
  { href: "/settings/permissions", label: "Permissions" },
];

function SettingsNavGroup({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/settings");
  const groupActive = SETTINGS_ITEMS.some((item) => navLinkActive(pathname, item.href));
  const [open, setOpen] = useState(inSettings);

  useEffect(() => {
    setOpen(inSettings);
  }, [inSettings]);

  return (
    <div
      className={`mt-1 space-y-0.5 rounded-lg border py-1 ${
        groupActive || open
          ? "border-zinc-700 bg-zinc-800/40"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (!inSettings) setOpen((v) => !v);
        }}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold ${
          groupActive
            ? "text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
        }`}
      >
        <span>Settings</span>
        <PeopleChevron open={open} />
      </button>
      {open &&
        SETTINGS_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            nested
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX;
}

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [me, setMe] = useState<MeResponse | null>(_me);
  const [dbHealth, setDbHealth] = useState<HealthResponse | null>(_health);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rosterAlertCount, setRosterAlertCount] = useState(0);
  const [makeupNeedsCount, setMakeupNeedsCount] = useState(0);
  const [trialsActiveCount, setTrialsActiveCount] = useState(0);

  // Run before paint to avoid sidebar flash on desktop.
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setSidebarOpen(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const signedIn =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("signed_in") === "1";
    if (signedIn) _me = null;

    if (_me !== null) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { _me = data as MeResponse | null; setMe(_me); })
      .catch(() => { _me = null; setMe(null); });

    if (_health !== null) return;
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => { _health = data as HealthResponse; setDbHealth(_health); })
      .catch(() => {
        const fallback: HealthResponse = {
          ok: false,
          db: { configured: false, connected: false, studentCount: 0, error: "Could not reach database health check." },
        };
        _health = fallback;
        setDbHealth(fallback);
      });
  }, []);

  useEffect(() => {
    if (!me?.isOwner) return;
    fetch("/api/admin-roster/alerts")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const n = (json?.conflictCount as number) ?? 0;
        setRosterAlertCount(n);
      })
      .catch(() => setRosterAlertCount(0));
  }, [me?.isOwner]);

  useEffect(() => {
    const r = me?.user?.role;
    if (!r || r === "tutor" || r === "relief_tutor") return;
    fetch("/api/makeup/count")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setMakeupNeedsCount((json?.needsCount as number) ?? 0);
      })
      .catch(() => setMakeupNeedsCount(0));
    fetch("/api/trials/count")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setTrialsActiveCount((json?.activeCount as number) ?? 0);
      })
      .catch(() => setTrialsActiveCount(0));
  }, [me?.user?.role]);

  const role = me?.user?.role as
    | "owner"
    | "staff"
    | "tutor"
    | "relief_tutor"
    | undefined;

  const navItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (!role || !item.roles.includes(role)) return false;
        if (role === "relief_tutor") {
          return (
            item.href === "/attendance/tutor" || item.href === "/calendar"
          );
        }
        if (!item.permission) return true;
        if (item.permission.role !== role) return true;
        const rolePerms = me?.permissions?.[item.permission.role] as
          | Record<string, boolean>
          | undefined;
        return rolePerms?.[item.permission.flag] === true;
      }),
    [role, me?.permissions],
  );

  const peopleNavItems = useMemo(
    () =>
      filterPeopleNavItems(me?.peopleTabs, {
        role,
        tutorCanViewPeople: me?.permissions?.tutor?.viewPeople === true,
      }),
    [me?.peopleTabs, me?.permissions?.tutor?.viewPeople, role],
  );

  /** Sidebar block order: show People subsection after this nav item. */
  const peopleNavAfterHref = useMemo(() => {
    if (navItems.some((i) => i.href === "/attendance")) return "/attendance";
    if (navItems.some((i) => i.href === "/attendance/tutor")) return "/attendance/tutor";
    if (navItems.some((i) => i.href === "/calendar")) return "/calendar";
    return navItems[0]?.href;
  }, [navItems]);

  const closeSidebarOnMobile = useCallback(() => {
    if (isMobileViewport()) setSidebarOpen(false);
  }, []);

  async function signOutGoogle() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const badge = me?.user?.roleLabel ?? role ?? "";

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  return (
    <div className="min-h-full">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-zinc-900/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-800 bg-zinc-900 transition-[transform,width] duration-200 ease-out max-md:w-52 max-md:shadow-xl ${
          sidebarOpen
            ? "max-md:translate-x-0 md:w-52 md:translate-x-0"
            : "max-md:-translate-x-full md:w-10 md:translate-x-0"
        }`}
      >
        <div
          className={`${HEADER_ROW} ${
            sidebarOpen ? "gap-2 px-3" : "justify-center px-1"
          }`}
        >
          {sidebarOpen ? (
            <Link
              href="/"
              className="flex min-w-0 flex-1 items-center gap-2 truncate"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon-light.png"
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
              />
              <span className="truncate text-lg font-semibold leading-none text-white">
                Staff Portal
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            className="hidden shrink-0 rounded-md p-1.5 hover:bg-zinc-800 md:block"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </button>
        </div>

        {sidebarOpen ? (
          <>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
              {navItems.map((item) => (
                <div key={`${item.href}-${item.label}`}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    onNavigate={closeSidebarOnMobile}
                    badge={item.href === "/makeup" ? makeupNeedsCount : item.href === "/trials" ? trialsActiveCount : undefined}
                  />
                  {item.href === peopleNavAfterHref &&
                    peopleNavItems.length > 0 && (
                      <PeopleNavGroup
                        items={peopleNavItems}
                        onNavigate={closeSidebarOnMobile}
                        rosterAlertCount={rosterAlertCount}
                      />
                    )}
                  {item.href === "/billing" && role === "owner" && (
                    <SettingsNavGroup onNavigate={closeSidebarOnMobile} />
                  )}
                </div>
              ))}
            </nav>

            <div className="border-t border-zinc-800 px-4 py-4">
              {me?.user ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-white">
                    {me.user.displayName || me.user.email}
                  </p>
                  <span className="inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {badge}
                  </span>
                  <button
                    type="button"
                    onClick={signOutGoogle}
                    className="block text-left text-xs font-medium text-orange-400 hover:underline"
                  >
                    Sign out Google
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-medium text-orange-400 hover:underline"
                >
                  Sign in
                </Link>
              )}
            </div>
          </>
        ) : null}
      </aside>

      <div
        className={`min-h-full transition-[padding] duration-200 ease-out max-md:pl-0 ${
          sidebarOpen ? "md:pl-52" : "md:pl-10"
        }`}
      >
        <header
          className={`${HEADER_ROW} sticky top-0 z-20 gap-3 bg-zinc-900 px-4 md:px-6`}
        >
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 hover:bg-zinc-800 md:hidden"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold leading-none text-white md:text-xl">
            {title}
          </h1>
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-full-light.jpg"
              alt="KNOCKOUT/MATH"
              className="h-10 w-auto shrink-0 object-contain mix-blend-screen"
            />
          </Link>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
          {dbHealth && !dbHealth.ok && (
            <div
              className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              <p className="font-semibold">Data is not being saved</p>
              <p className="mt-1">
                {dbHealth.db.error ??
                  "Database is not connected. Students, attendance, and enrollments will not persist."}
              </p>
              {dbHealth.db.connected && (
                <p className="mt-1 text-red-800">
                  Connected, but health check failed — try npm run db:push.
                </p>
              )}
            </div>
          )}
          {dbHealth?.ok && (
            <p className="mb-4 text-xs text-zinc-500">
              Database connected · {dbHealth.db.studentCount} student
              {dbHealth.db.studentCount === 1 ? "" : "s"} saved
            </p>
          )}
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
}
