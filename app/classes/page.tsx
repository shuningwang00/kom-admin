import AppShell from "@/components/app-shell";
import ClassesManager from "@/components/classes-manager";

export const dynamic = "force-dynamic";

export default function ClassesPage() {
  return (
    <AppShell title="Classes">
      <ClassesManager />
    </AppShell>
  );
}
