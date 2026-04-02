-- ============================================================================
-- AIGB Billing System - HTTP 402 Micropayments
-- Migration: billing_plans, billing_accounts, usage_records, billing_invoices
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. billing_plans — tarification par plan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price_cents INT NOT NULL DEFAULT 0,
  price_per_call_microcents INT NOT NULL DEFAULT 100,
  price_per_read_microcents INT,
  price_per_write_microcents INT,
  included_calls INT NOT NULL DEFAULT 0,
  max_calls_per_month INT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. billing_accounts — un par organisation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_payment_method_id TEXT,
  plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'past_due', 'suspended', 'cancelled')),
  billing_email TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  total_calls_this_period INT NOT NULL DEFAULT 0,
  total_cost_microcents_this_period BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- ---------------------------------------------------------------------------
-- 3. usage_records — chaque appel d'outil logge ici
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  execution_run_id UUID REFERENCES public.execution_runs(id),
  action_template_id UUID REFERENCES public.action_templates(id),
  api_key_id UUID REFERENCES public.agent_api_keys(id),
  tool_name TEXT,
  method TEXT,
  cost_microcents INT NOT NULL DEFAULT 0,
  stripe_usage_record_id TEXT,
  reported_to_stripe BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. billing_invoices — historique des factures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  amount_cents INT NOT NULL,
  total_calls INT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  pdf_url TEXT,
  hosted_invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. Ajout cost_microcents a execution_runs (optionnel, pour denormalisation)
-- ---------------------------------------------------------------------------
ALTER TABLE public.execution_runs
  ADD COLUMN IF NOT EXISTS cost_microcents INT DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 6. Index pour la performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usage_records_org_created
  ON public.usage_records(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_records_unreported
  ON public.usage_records(reported_to_stripe)
  WHERE reported_to_stripe = false;

CREATE INDEX IF NOT EXISTS idx_usage_records_project
  ON public.usage_records(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_org
  ON public.billing_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer
  ON public.billing_accounts(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org
  ON public.billing_invoices(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. RLS Policies
-- ---------------------------------------------------------------------------

-- billing_plans: lecture publique (tous les users auth)
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active billing plans"
  ON public.billing_plans FOR SELECT
  USING (is_active = true);

-- billing_accounts: scoped par org
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their billing account"
  ON public.billing_accounts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org owners/admins can update billing account"
  ON public.billing_accounts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners can insert billing account"
  ON public.billing_accounts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- usage_records: scoped par org (lecture seule pour les users)
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view usage records"
  ON public.usage_records FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- billing_invoices: scoped par org
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoices"
  ON public.billing_invoices FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Seed plans initiaux
-- ---------------------------------------------------------------------------
INSERT INTO public.billing_plans (name, description, base_price_cents, price_per_call_microcents, price_per_read_microcents, price_per_write_microcents, included_calls, max_calls_per_month)
VALUES
  ('starter', 'Free tier with 1000 included calls per month', 0, 100, 50, 150, 1000, 50000),
  ('growth', 'For growing teams - 10k included calls', 2900, 50, 25, 75, 10000, 500000),
  ('enterprise', 'Unlimited calls with custom pricing', 9900, 25, 10, 40, 100000, NULL)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Atomic increment for billing usage counters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_billing_usage(
  p_billing_account_id UUID,
  p_cost_microcents INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.billing_accounts
  SET
    total_calls_this_period = total_calls_this_period + 1,
    total_cost_microcents_this_period = total_cost_microcents_this_period + p_cost_microcents,
    updated_at = now()
  WHERE id = p_billing_account_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Helper function: get billing status for an org (used by edge functions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_billing_status(p_organization_id UUID)
RETURNS TABLE (
  billing_account_id UUID,
  status TEXT,
  plan_name TEXT,
  price_per_call_microcents INT,
  price_per_read_microcents INT,
  price_per_write_microcents INT,
  included_calls INT,
  total_calls_this_period INT,
  calls_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.id AS billing_account_id,
    ba.status,
    bp.name AS plan_name,
    bp.price_per_call_microcents,
    bp.price_per_read_microcents,
    bp.price_per_write_microcents,
    bp.included_calls,
    ba.total_calls_this_period,
    GREATEST(0, bp.included_calls - ba.total_calls_this_period) AS calls_remaining
  FROM public.billing_accounts ba
  JOIN public.billing_plans bp ON bp.id = ba.plan_id
  WHERE ba.organization_id = p_organization_id;
END;
$$;
