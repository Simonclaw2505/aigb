
-- 1. Add organization_id to api_sources to make tools org-level
ALTER TABLE public.api_sources 
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Populate organization_id from the project's organization
UPDATE public.api_sources 
SET organization_id = p.organization_id
FROM public.projects p 
WHERE api_sources.project_id = p.id;

-- Make organization_id NOT NULL after population
ALTER TABLE public.api_sources 
  ALTER COLUMN organization_id SET NOT NULL;

-- Make project_id nullable (tools are now org-level, not project-level)
ALTER TABLE public.api_sources 
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add organization_id to api_connectors to make them org-level  
ALTER TABLE public.api_connectors
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

UPDATE public.api_connectors
SET organization_id = p.organization_id
FROM public.projects p
WHERE api_connectors.project_id = p.id;

ALTER TABLE public.api_connectors
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.api_connectors
  ALTER COLUMN project_id DROP NOT NULL;

-- 3. Create agent_tools junction table
CREATE TABLE public.agent_tools (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  api_source_id uuid NOT NULL REFERENCES public.api_sources(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agent_id, api_source_id)
);

-- Enable RLS
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view agent_tools for their org's agents
CREATE POLICY "Members can view agent_tools"
  ON public.agent_tools FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = agent_tools.agent_id
    AND can_access_project(auth.uid(), p.id)
  ));

-- RLS: Members can manage agent_tools
CREATE POLICY "Members can manage agent_tools"
  ON public.agent_tools FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = agent_tools.agent_id
    AND get_project_org_role(auth.uid(), p.id) IN ('owner', 'admin', 'member')
  ));

-- 4. Update api_sources RLS to support org-level access
-- Drop old project-based policies and recreate with org support
DROP POLICY IF EXISTS "Members can view api_sources" ON public.api_sources;
DROP POLICY IF EXISTS "Members can create api_sources" ON public.api_sources;
DROP POLICY IF EXISTS "Members can update api_sources" ON public.api_sources;
DROP POLICY IF EXISTS "Admins can delete api_sources" ON public.api_sources;

CREATE POLICY "Members can view api_sources"
  ON public.api_sources FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can create api_sources"
  ON public.api_sources FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update api_sources"
  ON public.api_sources FOR UPDATE
  USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Admins can delete api_sources"
  ON public.api_sources FOR DELETE
  USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- 5. Update api_connectors RLS for org-level
DROP POLICY IF EXISTS "Members can view api_connectors" ON public.api_connectors;
DROP POLICY IF EXISTS "Admins can manage api_connectors" ON public.api_connectors;

CREATE POLICY "Members can view api_connectors"
  ON public.api_connectors FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage api_connectors"
  ON public.api_connectors FOR ALL
  USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- 6. Auto-create agent_tools entries for existing data
-- Link existing api_sources to their original projects as agents
INSERT INTO public.agent_tools (agent_id, api_source_id)
SELECT DISTINCT s.project_id, s.id
FROM public.api_sources s
WHERE s.project_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. Index for performance
CREATE INDEX idx_agent_tools_agent_id ON public.agent_tools(agent_id);
CREATE INDEX idx_agent_tools_api_source_id ON public.agent_tools(api_source_id);
CREATE INDEX idx_api_sources_organization_id ON public.api_sources(organization_id);
CREATE INDEX idx_api_connectors_organization_id ON public.api_connectors(organization_id);
