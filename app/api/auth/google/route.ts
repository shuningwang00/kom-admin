import { getGoogleAuthUrl, type GoogleAuthMode } from "@/lib/google/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const modeParam = new URL(request.url).searchParams.get("mode");
    const mode: GoogleAuthMode = modeParam === "signin" ? "signin" : "sheets";
    const url = getGoogleAuthUrl(mode);
    return NextResponse.redirect(url);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google OAuth not configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
