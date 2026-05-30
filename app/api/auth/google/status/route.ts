import { getGoogleAuthStatus } from "@/lib/google/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const status = await getGoogleAuthStatus();
  return NextResponse.json(status);
}
