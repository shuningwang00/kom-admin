import AppShell from "@/components/app-shell";
import SessionAttendancePanel from "@/components/session-attendance-panel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function SessionAttendancePage({ params }: Props) {
  const { id } = await params;
  return (
    <AppShell title="Mark attendance">
      <SessionAttendancePanel sessionId={id} />
    </AppShell>
  );
}
