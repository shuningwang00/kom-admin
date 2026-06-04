import AppShell from "@/components/app-shell";
import BillingTabs from "@/components/billing-tabs";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Billing">
      <div className="space-y-6">
        <BillingTabs />
        {children}
      </div>
    </AppShell>
  );
}
