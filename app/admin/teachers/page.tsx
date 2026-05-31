import AppShell from "@/components/app-shell";
import TeachersAllowlist from "@/components/teachers-allowlist";

export default function TeachersAdminPage() {
  return (
    <AppShell title="Team access">
      <TeachersAllowlist />
    </AppShell>
  );
}
