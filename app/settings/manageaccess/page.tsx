import AppShell from "@/components/app-shell";
import TeachersAllowlist from "@/components/teachers-allowlist";

export default function ManageAccessPage() {
  return (
    <AppShell title="Manage access">
      <TeachersAllowlist />
    </AppShell>
  );
}
