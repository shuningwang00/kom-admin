import AppShell from "@/components/app-shell";
import MakeupManager from "@/components/makeup-manager";

export const dynamic = "force-dynamic";

export default function MakeupPage() {
  return (
    <AppShell title="Makeup">
      <MakeupManager />
    </AppShell>
  );
}
