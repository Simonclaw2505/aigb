/**
 * Billing hooks for AIGB
 * Handles billing status, usage data, invoices, and Stripe setup
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type UntypedQueryBuilder = {
  select: (...args: unknown[]) => UntypedQueryBuilder;
  eq: (...args: unknown[]) => UntypedQueryBuilder;
  gte: (...args: unknown[]) => UntypedQueryBuilder;
  order: (...args: unknown[]) => UntypedQueryBuilder;
  limit: (...args: unknown[]) => UntypedQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

const fromUntyped = (table: string) =>
  supabase.from(table as never) as unknown as UntypedQueryBuilder;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BillingPlan {
  id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  price_per_call_microcents: number;
  price_per_read_microcents: number | null;
  price_per_write_microcents: number | null;
  included_calls: number;
  max_calls_per_month: number | null;
  is_active: boolean;
}

export interface BillingAccount {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  status: "inactive" | "active" | "past_due" | "suspended" | "cancelled";
  billing_email: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  total_calls_this_period: number;
  total_cost_microcents_this_period: number;
  billing_plans: BillingPlan | null;
}

export interface UsageRecord {
  id: string;
  project_id: string;
  tool_name: string | null;
  method: string | null;
  cost_microcents: number;
  created_at: string;
}

export interface BillingInvoice {
  id: string;
  stripe_invoice_id: string | null;
  amount_cents: number;
  total_calls: number;
  period_start: string;
  period_end: string;
  status: string;
  pdf_url: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
}

export interface UsageByDay {
  date: string;
  calls: number;
  cost_microcents: number;
}

// ---------------------------------------------------------------------------
// useBillingAccount — main billing status
// ---------------------------------------------------------------------------

export function useBillingAccount(organizationId: string | null) {
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await fromUntyped("billing_accounts")
        .select(`
          *,
          billing_plans:plan_id (*)
        `)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setAccount(data as unknown as BillingAccount);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch billing account:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { account, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// useBillingPlans — available plans
// ---------------------------------------------------------------------------

export function useBillingPlans() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await fromUntyped("billing_plans")
          .select("*")
          .eq("is_active", true)
          .order("base_price_cents", { ascending: true });

        if (error) throw error;
        setPlans(data as unknown as BillingPlan[]);
      } catch (err) {
        console.error("Failed to fetch billing plans:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return { plans, loading };
}

// ---------------------------------------------------------------------------
// useUsageRecords — recent usage
// ---------------------------------------------------------------------------

export function useUsageRecords(organizationId: string | null, days = 30) {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [dailyUsage, setDailyUsage] = useState<UsageByDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data, error } = await fromUntyped("usage_records")
          .select("id, project_id, tool_name, method, cost_microcents, created_at")
          .eq("organization_id", organizationId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) throw error;

        setRecords(data as UsageRecord[]);

        // Aggregate by day
        const byDay = new Map<string, { calls: number; cost_microcents: number }>();
        for (const record of data || []) {
          const day = record.created_at.slice(0, 10);
          const existing = byDay.get(day) ?? { calls: 0, cost_microcents: 0 };
          existing.calls += 1;
          existing.cost_microcents += record.cost_microcents;
          byDay.set(day, existing);
        }

        const daily = Array.from(byDay.entries())
          .map(([date, stats]) => ({ date, ...stats }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setDailyUsage(daily);
      } catch (err) {
        console.error("Failed to fetch usage records:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [organizationId, days]);

  return { records, dailyUsage, loading };
}

// ---------------------------------------------------------------------------
// useInvoices — invoice history
// ---------------------------------------------------------------------------

export function useInvoices(organizationId: string | null) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await fromUntyped("billing_invoices")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setInvoices(data as BillingInvoice[]);
      } catch (err) {
        console.error("Failed to fetch invoices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [organizationId]);

  return { invoices, loading };
}

// ---------------------------------------------------------------------------
// Billing actions
// ---------------------------------------------------------------------------

export function useBillingActions() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const setupBilling = async (
    organizationId: string,
    planName?: string,
    billingEmail?: string,
  ): Promise<{ checkout_url?: string; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-setup", {
        body: {
          organization_id: organizationId,
          plan_name: planName,
          billing_email: billingEmail,
        },
      });

      if (error) throw error;
      return { checkout_url: data.checkout_url };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Setup failed" };
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async (
    organizationId: string,
  ): Promise<{ portal_url?: string; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-setup", {
        body: {
          organization_id: organizationId,
          action: "portal",
        },
      });

      if (error) throw error;
      return { portal_url: data.portal_url };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Portal failed" };
    } finally {
      setLoading(false);
    }
  };

  return { setupBilling, openPortal, loading };
}
