import AppShell from "@/components/app-shell";
import BillingDashboard from "@/components/billing-dashboard";

export default function BillingPage() {
  return (
    <AppShell title="Billing">
      <BillingDashboard />
    </AppShell>
  );
}
