import { NextResponse } from "next/server";

/** Site password login removed — use Google sign-in at /login. */
export async function POST() {
  return NextResponse.json(
    { error: "Sign in with Google at /login." },
    { status: 410 },
  );
}
