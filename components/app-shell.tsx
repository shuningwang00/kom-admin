"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MeResponse = {
  user: {
    email: string;
    role: string;
    roleLabel?: string;
    displayName: string;
  } | null;
  isOwner: boolean;
};

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-orange-100 px-3 py-2 text-sm font-medium text-orange-900"
          : "rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }
    >
      {label}
    </Link>
  );
}

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data as MeResponse | null))
      .catch(() => setMe(null));
  }, []);

  const role = me?.user?.role ?? "owner";
  const isTutor = role === "tutor";
  const isStaff = role === "staff";
  const isOwner = me?.isOwner ?? role === "owner";

  async function signOutGoogle() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const badge =
    me?.user?.roleLabel ??
    (role === "owner" ? "Owner" : role === "staff" ? "Staff" : "Tutor");

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            KOM Admin
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {isTutor ? (
              <>
                <NavLink href="/attendance/tutor" label="My classes" />
                <NavLink href="/attendance" label="By day" />
              </>
            ) : isStaff ? (
              <>
                <NavLink href="/attendance" label="Attendance" />
                <NavLink href="/students" label="Students" />
                <NavLink href="/enrollments" label="Enrollments" />
                <NavLink href="/billing" label="Billing" />
              </>
            ) : (
              <>
                <NavLink href="/attendance" label="Attendance" />
                <NavLink href="/students" label="Students" />
                <NavLink href="/classes" label="Classes" />
                <NavLink href="/enrollments" label="Enrollments" />
                <NavLink href="/billing" label="Billing" />
              </>
            )}
            {isOwner && (
              <NavLink href="/admin/teachers" label="Team access" />
            )}
          </nav>
          <div className="text-right text-xs text-zinc-500">
            {me?.user ? (
              <div className="flex flex-col items-end gap-1">
                <span>
                  {me.user.displayName || me.user.email}
                  <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                    {badge}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={signOutGoogle}
                  className="text-orange-700 hover:underline"
                >
                  Sign out Google
                </button>
              </div>
            ) : (
              <Link
                href="/api/auth/google?mode=signin"
                className="font-medium text-orange-700 hover:underline"
              >
                Sign in with Google
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
