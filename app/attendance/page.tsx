import AppShell from "@/components/app-shell";
import AttendanceDaily from "@/components/attendance-daily";

export default function AttendancePage() {
  return (
    <AppShell title="Attendance">
      <AttendanceDaily />
    </AppShell>
  );
}
