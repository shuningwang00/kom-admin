import AppShell from "@/components/app-shell";
import PeopleManager from "@/components/people-manager";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  return (
    <AppShell title="People">
      <PeopleManager />
    </AppShell>
  );
}
