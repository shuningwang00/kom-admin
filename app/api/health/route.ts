import { getEffectiveUser } from "@/lib/auth/user";
import { getAdminPassword } from "@/lib/config";
import { checkDbHealth } from "@/lib/db/health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (getAdminPassword() && !(await getEffectiveUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await checkDbHealth();
  const ok = db.configured && db.connected;
  return NextResponse.json(
    { ok, db },
    { status: ok ? 200 : 503 },
  );
}
