import AppShell from "@/components/app-shell";
import BillingDashboard from "@/components/billing-dashboard";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <AppShell title="Billing">
      <BillingDashboard />
    </AppShell>
  );
}
