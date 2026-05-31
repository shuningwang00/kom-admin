import AppShell from "@/components/app-shell";
import StudentsManager from "@/components/students-manager";

export default function StudentsPage() {
  return (
    <AppShell title="Students">
      <StudentsManager />
    </AppShell>
  );
}
