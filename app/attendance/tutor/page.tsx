import AppShell from "@/components/app-shell";
import AttendanceTutorOverview from "@/components/attendance-tutor-overview";

export const dynamic = "force-dynamic";

export default function TutorAttendancePage() {
  return (
    <AppShell title="My classes">
      <AttendanceTutorOverview />
    </AppShell>
  );
}
