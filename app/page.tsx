import { getEffectiveUser } from "@/lib/auth/user";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasSitePasswordAuth())) {
    redirect("/login");
  }
  const user = await getEffectiveUser();
  if (user?.role === "tutor") {
    redirect("/attendance/tutor");
  }
  if (user?.role === "staff") {
    redirect("/attendance");
  }
  redirect("/attendance");
}
