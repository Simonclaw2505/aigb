
-- Create agent_api_keys table
CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  rate_limit_per_hour integer DEFAULT NULL,
  expires_at timestamptz DEFAULT NULL,
  last_used_at timestamptz DEFAULT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index on key_hash for fast lookups
CREATE UNIQUE INDEX idx_agent_api_keys_key_hash ON public.agent_api_keys (key_hash);

-- Enable RLS
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

-- Admins/owners can do everything
CREATE POLICY "Admins can manage agent_api_keys"
  ON public.agent_api_keys
  FOR ALL
  USING (get_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

-- Members can view keys (metadata only, hash is useless anyway)
CREATE POLICY "Members can view agent_api_keys"
  ON public.agent_api_keys
  FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
