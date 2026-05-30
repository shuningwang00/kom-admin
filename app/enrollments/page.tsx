import AppShell from "@/components/app-shell";
import EnrollmentsManager from "@/components/enrollments-manager";

export const dynamic = "force-dynamic";

export default function EnrollmentsPage() {
  return (
    <AppShell title="Enrollments">
      <EnrollmentsManager />
    </AppShell>
  );
}
