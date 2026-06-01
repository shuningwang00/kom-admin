"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const googleError = searchParams.get("google_error");

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-full-dark.png" alt="KNOCKOUT/MATH" className="mx-auto h-20 w-auto object-contain" />
      <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Staff Portal</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sign in with your personal Google account. If you do not have access,
        please reach out to Shuning.
      </p>

      {googleError === "not_allowlisted" && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your Google account is not on Team access. Ask the centre owner to add
          your Gmail address.
        </p>
      )}

      {googleError && googleError !== "not_allowlisted" && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Sign-in failed ({googleError}). Try again or contact the centre owner.
        </p>
      )}

      <a
        href="/api/auth/google?mode=signin"
        className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700"
      >
        Sign in with Google
      </a>
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
