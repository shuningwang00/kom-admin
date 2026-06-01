import { isOwnerEmail } from "@/lib/auth/config";
import { getEffectiveUser } from "@/lib/auth/user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PeopleIndexPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");

  if (isOwnerEmail(user.email) || user.role === "owner") {
    redirect("/people/admin-roster");
  }
  if (user.allowlistRole === "staff" || user.allowlistRole === "staff_tutor") {
    redirect("/people/availability");
  }
  redirect("/people/time-off");
}
