import AppShell from "@/components/app-shell";
import EnrollmentsManager from "@/components/enrollments-manager";

export default function EnrollmentsPage() {
  return (
    <AppShell title="Enrollments">
      <EnrollmentsManager />
    </AppShell>
  );
}
