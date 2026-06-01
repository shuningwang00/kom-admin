import AppShell from "@/components/app-shell";
import ProgrammeDetail from "@/components/programme-detail";

export default async function ProgrammeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell title="Programme">
      <ProgrammeDetail programmeId={id} />
    </AppShell>
  );
}
