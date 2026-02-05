
-- Create enum for agent capability policy
CREATE TYPE public.agent_capability_policy AS ENUM (
  'allow',
  'deny', 
  'require_confirmation',
  'require_approval'
);

-- Agent capabilities: what actions the agent can do per project
CREATE TABLE public.agent_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action_template_id UUID REFERENCES public.action_templates(id) ON DELETE CASCADE,
  action_name TEXT, -- For global rules without specific action
  policy agent_capability_policy NOT NULL DEFAULT 'allow',
  approval_roles app_role[] DEFAULT ARRAY['owner', 'admin']::app_role[],
  max_executions_per_hour INTEGER,
  max_executions_per_day INTEGER,
  allowed_environments environment_type[] DEFAULT ARRAY['development', 'staging', 'production']::environment_type[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, action_template_id)
);

-- ABAC conditions for user permissions
CREATE TABLE public.user_permission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject_role app_role,
  subject_user_id UUID REFERENCES auth.users(id),
  resource_type TEXT NOT NULL, -- 'action', 'project', 'endpoint', etc.
  resource_id UUID, -- NULL means all resources of type
  action TEXT NOT NULL, -- 'execute', 'read', 'write', 'delete', 'export'
  effect policy_effect NOT NULL DEFAULT 'allow',
  -- ABAC conditions as JSONB
  conditions JSONB DEFAULT '{}',
  -- Examples: {"region": {"eq": "user.region"}}, {"amount": {"lte": 10000}}
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permission evaluation logs (for audit)
CREATE TABLE public.permission_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  agent_session_id TEXT,
  action_template_id UUID REFERENCES public.action_templates(id),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  requested_action TEXT NOT NULL,
  evaluation_result policy_effect NOT NULL,
  matched_rules UUID[], -- IDs of rules that matched
  evaluation_details JSONB, -- Full evaluation trace
  requires_confirmation BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT false,
  approval_status approval_status,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_capabilities
CREATE POLICY "Admins can manage agent_capabilities"
ON public.agent_capabilities FOR ALL
USING (get_project_org_role(auth.uid(), project_id) IN ('owner', 'admin'));

CREATE POLICY "Members can view agent_capabilities"
ON public.agent_capabilities FOR SELECT
USING (can_access_project(auth.uid(), project_id));

-- RLS policies for user_permission_rules
CREATE POLICY "Admins can manage user_permission_rules"
ON public.user_permission_rules FOR ALL
USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Members can view user_permission_rules"
ON public.user_permission_rules FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

-- RLS policies for permission_evaluations
CREATE POLICY "Admins can view permission_evaluations"
ON public.permission_evaluations FOR SELECT
USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "System can insert permission_evaluations"
ON public.permission_evaluations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_agent_capabilities_project ON public.agent_capabilities(project_id);
CREATE INDEX idx_agent_capabilities_action ON public.agent_capabilities(action_template_id);
CREATE INDEX idx_user_permission_rules_org ON public.user_permission_rules(organization_id);
CREATE INDEX idx_user_permission_rules_role ON public.user_permission_rules(subject_role);
CREATE INDEX idx_permission_evaluations_org ON public.permission_evaluations(organization_id);
CREATE INDEX idx_permission_evaluations_user ON public.permission_evaluations(user_id);
CREATE INDEX idx_permission_evaluations_time ON public.permission_evaluations(evaluated_at DESC);

-- Function to evaluate permissions (server-side enforcement)
CREATE OR REPLACE FUNCTION public.evaluate_permission(
  _user_id UUID,
  _organization_id UUID,
  _resource_type TEXT,
  _resource_id UUID,
  _action TEXT,
  _context JSONB DEFAULT '{}'
)
RETURNS TABLE(
  allowed BOOLEAN,
  requires_confirmation BOOLEAN,
  requires_approval BOOLEAN,
  matched_rule_ids UUID[],
  denial_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  rule RECORD;
  matched_ids UUID[] := ARRAY[]::UUID[];
  is_allowed BOOLEAN := false;
  needs_confirm BOOLEAN := false;
  needs_approve BOOLEAN := false;
  deny_reason TEXT;
BEGIN
  -- Get user's role in the organization
  SELECT role INTO user_role
  FROM public.organization_members
  WHERE user_id = _user_id AND organization_id = _organization_id;
  
  -- If not a member, deny
  IF user_role IS NULL THEN
    RETURN QUERY SELECT false, false, false, ARRAY[]::UUID[], 'User is not a member of this organization';
    RETURN;
  END IF;
  
  -- Owners have full access
  IF user_role = 'owner' THEN
    RETURN QUERY SELECT true, false, false, ARRAY[]::UUID[], NULL::TEXT;
    RETURN;
  END IF;
  
  -- Evaluate rules in priority order (higher priority first)
  FOR rule IN 
    SELECT * FROM public.user_permission_rules upr
    WHERE upr.organization_id = _organization_id
      AND upr.is_active = true
      AND upr.resource_type = _resource_type
      AND (upr.resource_id IS NULL OR upr.resource_id = _resource_id)
      AND upr.action = _action
      AND (upr.subject_role IS NULL OR upr.subject_role = user_role)
      AND (upr.subject_user_id IS NULL OR upr.subject_user_id = _user_id)
    ORDER BY upr.priority DESC, upr.created_at ASC
  LOOP
    matched_ids := array_append(matched_ids, rule.id);
    
    IF rule.effect = 'deny' THEN
      deny_reason := COALESCE(rule.description, 'Access denied by policy: ' || rule.name);
      RETURN QUERY SELECT false, false, false, matched_ids, deny_reason;
      RETURN;
    END IF;
    
    IF rule.effect = 'allow' THEN
      is_allowed := true;
    END IF;
  END LOOP;
  
  -- Default: allow for admin, member with read; deny others
  IF NOT is_allowed THEN
    IF user_role IN ('admin', 'member') AND _action IN ('read', 'execute') THEN
      is_allowed := true;
    ELSIF user_role = 'viewer' AND _action = 'read' THEN
      is_allowed := true;
    ELSE
      deny_reason := 'No matching permission rule found';
    END IF;
  END IF;
  
  RETURN QUERY SELECT is_allowed, needs_confirm, needs_approve, matched_ids, deny_reason;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_agent_capabilities_updated_at
  BEFORE UPDATE ON public.agent_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permission_rules_updated_at
  BEFORE UPDATE ON public.user_permission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
