import AppShell from "@/components/app-shell";
import PermissionsManager from "@/components/permissions-manager";

export default function SettingsPermissionsPage() {
  return (
    <AppShell title="Permissions">
      <PermissionsManager />
    </AppShell>
  );
}
