import AppShell from "@/components/app-shell";
import PeopleShell from "@/components/people/people-shell";

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell title="People">
      <PeopleShell>{children}</PeopleShell>
    </AppShell>
  );
}
