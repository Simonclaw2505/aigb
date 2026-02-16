
-- Table agent_members: links a user to a specific agent with a per-agent role
CREATE TABLE public.agent_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member'::public.app_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (agent_id, user_id)
);

-- Enable RLS
ALTER TABLE public.agent_members ENABLE ROW LEVEL SECURITY;

-- Admins/owners of the org can manage agent members
CREATE POLICY "Admins can manage agent_members"
ON public.agent_members
FOR ALL
USING (
  get_project_org_role(auth.uid(), agent_id) IN ('owner'::public.app_role, 'admin'::public.app_role)
);

-- Org members can view agent members
CREATE POLICY "Members can view agent_members"
ON public.agent_members
FOR SELECT
USING (
  can_access_project(auth.uid(), agent_id)
);

-- Function to get user's role on a specific agent
CREATE OR REPLACE FUNCTION public.get_agent_role(_user_id uuid, _agent_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.agent_members
  WHERE user_id = _user_id AND agent_id = _agent_id
  LIMIT 1
$$;

-- Add optional agent_id column to user_permission_rules for scoping rules per agent
ALTER TABLE public.user_permission_rules
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- Allow profiles to be viewed by org co-members (needed for Team panel)
CREATE POLICY "Org members can view co-member profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om1
    JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.user_id
  )
);
