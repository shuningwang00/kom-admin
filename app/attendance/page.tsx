import AppShell from "@/components/app-shell";
import AttendanceDaily from "@/components/attendance-daily";

export const dynamic = "force-dynamic";

export default function AttendancePage() {
  return (
    <AppShell title="Attendance (daily)">
      <AttendanceDaily />
    </AppShell>
  );
}
