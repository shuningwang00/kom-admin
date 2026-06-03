import AppShell from "@/components/app-shell";
import ScheduleManager from "@/components/schedule/schedule-manager";

export default function SchedulePage() {
  return (
    <AppShell title="Schedule">
      <ScheduleManager />
    </AppShell>
  );
}
