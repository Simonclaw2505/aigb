/**
 * Billing page for AIGB
 * Manage subscription, view usage, and payment methods
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { BillingOverview } from "@/components/billing/BillingOverview";
import { UsageChart } from "@/components/billing/UsageChart";
import { PlanSelector } from "@/components/billing/PlanSelector";
import { InvoiceHistory } from "@/components/billing/InvoiceHistory";
import {
  useBillingAccount,
  useBillingPlans,
  useUsageRecords,
  useInvoices,
  useBillingActions,
} from "@/hooks/useBilling";

export default function Billing() {
  const { user } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's organization
  useEffect(() => {
    const fetchOrg = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (data) setOrganizationId(data.organization_id);
      } catch (err) {
        console.error("Failed to fetch org:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, [user]);

  const { account, loading: accountLoading, refetch: refetchAccount } = useBillingAccount(organizationId);
  const { plans, loading: plansLoading } = useBillingPlans();
  const { dailyUsage, loading: usageLoading } = useUsageRecords(organizationId);
  const { invoices, loading: invoicesLoading } = useInvoices(organizationId);
  const { setupBilling, openPortal, loading: actionLoading } = useBillingActions();

  const handleSetupBilling = async (planName: string) => {
    if (!organizationId) return;
    const result = await setupBilling(organizationId, planName);
    if (result.checkout_url) {
      window.open(result.checkout_url, "_blank");
    }
  };

  const handleOpenPortal = async () => {
    if (!organizationId) return;
    const result = await openPortal(organizationId);
    if (result.portal_url) {
      window.open(result.portal_url, "_blank");
    }
  };

  if (loading || accountLoading) {
    return (
      <DashboardLayout title="Billing" description="Manage your subscription and usage">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Billing" description="Manage your subscription, usage, and invoices">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <BillingOverview
            account={account}
            onSetupBilling={() => handleSetupBilling("starter")}
            onOpenPortal={handleOpenPortal}
            onRefresh={refetchAccount}
            actionLoading={actionLoading}
          />
        </TabsContent>

        <TabsContent value="usage">
          <UsageChart
            dailyUsage={dailyUsage}
            loading={usageLoading}
            account={account}
          />
        </TabsContent>

        <TabsContent value="plans">
          <PlanSelector
            plans={plans}
            currentPlanId={account?.plan_id ?? null}
            loading={plansLoading}
            onSelectPlan={handleSetupBilling}
            actionLoading={actionLoading}
          />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceHistory
            invoices={invoices}
            loading={invoicesLoading}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
