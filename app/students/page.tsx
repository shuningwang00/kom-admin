import AppShell from "@/components/app-shell";
import StudentsManager from "@/components/students-manager";

export const dynamic = "force-dynamic";

export default function StudentsPage() {
  return (
    <AppShell title="Students">
      <StudentsManager />
    </AppShell>
  );
}
