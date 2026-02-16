
-- Create operator_keys table
CREATE TABLE public.operator_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member'::public.app_role,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_keys_agent_id ON public.operator_keys(agent_id);
CREATE INDEX idx_operator_keys_key_hash ON public.operator_keys(key_hash);

ALTER TABLE public.operator_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage operator_keys"
  ON public.operator_keys FOR ALL
  USING (get_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]));

CREATE POLICY "Members can view operator_keys"
  ON public.operator_keys FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- Function to look up operator by key hash
CREATE OR REPLACE FUNCTION public.get_operator_by_key_hash(_key_hash text)
RETURNS TABLE(id uuid, agent_id uuid, organization_id uuid, name text, role public.app_role, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ok.id, ok.agent_id, ok.organization_id, ok.name, ok.role, ok.is_active
  FROM public.operator_keys ok
  WHERE ok.key_hash = _key_hash
  LIMIT 1
$$;
