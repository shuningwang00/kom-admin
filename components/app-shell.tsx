"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const MOBILE_MAX = 767;
const HEADER_ROW =
  "flex h-14 shrink-0 items-center border-b border-zinc-800";

type MeResponse = {
  user: {
    email: string;
    role: string;
    roleLabel?: string;
    displayName: string;
  } | null;
  isOwner: boolean;
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

type NavItem = {
  href: string;
  label: string;
  roles: Array<"owner" | "staff" | "tutor">;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/attendance/tutor", label: "My classes", roles: ["tutor"] },
  { href: "/attendance", label: "By day", roles: ["tutor"] },
  { href: "/attendance", label: "Attendance", roles: ["owner", "staff"] },
  { href: "/calendar", label: "Calendar", roles: ["owner", "staff", "tutor"] },
  { href: "/people", label: "People", roles: ["owner", "staff", "tutor"] },
  { href: "/makeup", label: "Makeup", roles: ["owner", "staff"] },
  { href: "/trials", label: "Trials", roles: ["owner", "staff"] },
  { href: "/students", label: "Students", roles: ["owner", "staff"] },
  { href: "/classes", label: "Classes", roles: ["owner"] },
  { href: "/enrollments", label: "Enrollments", roles: ["owner", "staff"] },
  { href: "/billing", label: "Billing", roles: ["owner", "staff"] },
  { href: "/admin/teachers", label: "Team access", roles: ["owner"] },
];

function MenuIcon() {
  return (
    <svg
      className="h-6 w-6 text-zinc-700"
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

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/attendance" && pathname.startsWith(`${href}/`)) ||
    (href === "/attendance" &&
      pathname.startsWith("/attendance") &&
      !pathname.startsWith("/attendance/tutor"));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        active
          ? "block rounded-lg border-l-2 border-orange-500 bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-900"
          : "block rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }
    >
      {label}
    </Link>
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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [dbHealth, setDbHealth] = useState<HealthResponse | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setSidebarOpen(mq.matches);

    const onChange = (e: MediaQueryListEvent) => {
      setSidebarOpen(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data as MeResponse | null))
      .catch(() => setMe(null));
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setDbHealth(data as HealthResponse))
      .catch(() =>
        setDbHealth({
          ok: false,
          db: {
            configured: false,
            connected: false,
            studentCount: 0,
            error: "Could not reach database health check.",
          },
        }),
      );
  }, []);

  const role = (me?.user?.role ?? "owner") as "owner" | "staff" | "tutor";

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(role)),
    [role],
  );

  const closeSidebarOnMobile = useCallback(() => {
    if (isMobileViewport()) setSidebarOpen(false);
  }, []);

  async function signOutGoogle() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const badge =
    me?.user?.roleLabel ??
    (role === "owner" ? "Owner" : role === "staff" ? "Staff" : "Tutor");

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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 bg-white transition-[transform,width] duration-200 ease-out max-md:w-52 max-md:shadow-xl ${
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
                src="/logo-icon-dark.png"
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
              />
              <span className="truncate text-lg font-semibold leading-none text-zinc-900">
                Staff Portal
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            className="hidden shrink-0 rounded-md p-1.5 hover:bg-zinc-100 md:block"
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
                <NavLink
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  label={item.label}
                  onNavigate={closeSidebarOnMobile}
                />
              ))}
            </nav>

            <div className="border-t border-zinc-200 px-4 py-4">
              {me?.user ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-zinc-900">
                    {me.user.displayName || me.user.email}
                  </p>
                  <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {badge}
                  </span>
                  <button
                    type="button"
                    onClick={signOutGoogle}
                    className="block text-left text-xs font-medium text-orange-700 hover:underline"
                  >
                    Sign out Google
                  </button>
                </div>
              ) : (
                <Link
                  href="/api/auth/google?mode=signin"
                  className="text-sm font-medium text-orange-700 hover:underline"
                >
                  Sign in with Google
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
          className={`${HEADER_ROW} sticky top-0 z-20 gap-3 bg-white px-4 md:px-6`}
        >
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 hover:bg-zinc-100 md:hidden"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold leading-none text-zinc-900 md:text-xl">
            {title}
          </h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full-dark.png"
            alt="KNOCKOUT/MATH"
            className="h-7 w-auto shrink-0 object-contain"
          />
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
