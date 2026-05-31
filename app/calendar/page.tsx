import AppShell from "@/components/app-shell";
import CalendarView from "@/components/calendar-view";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <CalendarView />
    </AppShell>
  );
}
