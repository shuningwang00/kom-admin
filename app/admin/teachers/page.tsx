import AppShell from "@/components/app-shell";
import TeachersAllowlist from "@/components/teachers-allowlist";

export const dynamic = "force-dynamic";

export default function TeachersAdminPage() {
  return (
    <AppShell title="Team access">
      <TeachersAllowlist />
    </AppShell>
  );
}
