import { getAdminPassword } from "@/lib/config";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "kom_billing_auth";

export async function hasSitePasswordAuth(): Promise<boolean> {
  const password = getAdminPassword();
  if (!password) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === "1";
}
