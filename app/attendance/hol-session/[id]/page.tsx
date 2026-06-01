import AppShell from "@/components/app-shell";
import HolSessionAttendancePanel from "@/components/hol-session-attendance-panel";

export default async function HolSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell title="Programme Session">
      <HolSessionAttendancePanel sessionId={id} />
    </AppShell>
  );
}
