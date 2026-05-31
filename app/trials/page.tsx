import AppShell from "@/components/app-shell";
import TrialsManager from "@/components/trials-manager";

export const dynamic = "force-dynamic";

export default function TrialsPage() {
  return (
    <AppShell title="Trials">
      <TrialsManager />
    </AppShell>
  );
}
