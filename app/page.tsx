import { getEffectiveUser } from "@/lib/auth/user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getEffectiveUser();
  if (!user) {
    redirect("/login");
  }
  if (user?.role === "tutor") {
    redirect("/attendance/tutor");
  }
  if (user?.role === "staff") {
    redirect("/attendance");
  }
  redirect("/attendance");
}
