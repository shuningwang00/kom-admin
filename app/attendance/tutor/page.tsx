import AppShell from "@/components/app-shell";
import AttendanceTutorOverview from "@/components/attendance-tutor-overview";

export default function TutorAttendancePage() {
  return (
    <AppShell title="My classes">
      <AttendanceTutorOverview />
    </AppShell>
  );
}
