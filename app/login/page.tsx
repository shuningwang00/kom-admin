"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/students";
  const googleError = searchParams.get("google_error");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">KOM Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Enter the site password. Admins and tutors sign in with Google after
        unlocking.
      </p>

      {googleError === "not_allowlisted" && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your Google account is not on the tutor allowlist. Ask the centre admin
          to add you.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Admin password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>

      <div className="mt-8 border-t border-zinc-200 pt-8">
        <p className="text-sm font-medium text-zinc-700">Admin / Tutor</p>
        <a
          href="/api/auth/google?mode=signin"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
