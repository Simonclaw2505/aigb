-- =============================================================================
-- MCP FOUNDRY - EXTENDED MULTI-TENANT DATA MODEL
-- =============================================================================
-- This migration adds comprehensive tables for API management, MCP generation,
-- permissions, approvals, execution tracking, and secrets management.
-- All tables enforce RLS so users only access their organization's data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS for type safety
-- -----------------------------------------------------------------------------

-- Source types for API imports
CREATE TYPE public.api_source_type AS ENUM ('openapi', 'swagger', 'graphql', 'grpc', 'manual');

-- Status for various resources
CREATE TYPE public.resource_status AS ENUM ('pending', 'active', 'disabled', 'archived');

-- HTTP methods for endpoints
CREATE TYPE public.http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');

-- Execution status
CREATE TYPE public.execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'timeout', 'cancelled');

-- Approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- Policy effect (allow/deny)
CREATE TYPE public.policy_effect AS ENUM ('allow', 'deny');

-- Environment type
CREATE TYPE public.environment_type AS ENUM ('development', 'staging', 'production');

-- -----------------------------------------------------------------------------
-- API_SOURCES: Imported API specifications (OpenAPI, Swagger, etc.)
-- -----------------------------------------------------------------------------
-- Stores the original API specifications that users import into the system.
-- Each source belongs to a project and contains the raw spec + metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE public.api_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Source metadata
  name TEXT NOT NULL,
  description TEXT,
  source_type api_source_type NOT NULL DEFAULT 'openapi',
  version TEXT,                          -- API version (e.g., "3.0.1")
  
  -- The actual specification
  spec_url TEXT,                         -- URL where spec was fetched from
  spec_content JSONB,                    -- Raw spec content (JSON/parsed YAML)
  spec_hash TEXT,                        -- SHA256 hash for change detection
  
  -- Validation & parsing status
  status resource_status NOT NULL DEFAULT 'pending',
  validation_errors JSONB,               -- Array of validation issues
  parsed_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_sources IS 'Imported API specifications (OpenAPI, Swagger, etc.) for MCP conversion';
COMMENT ON COLUMN public.api_sources.spec_hash IS 'SHA256 hash of spec_content for detecting changes on re-import';

-- -----------------------------------------------------------------------------
-- ENDPOINTS: Individual API endpoints extracted from sources
-- -----------------------------------------------------------------------------
-- Parsed endpoints from API sources. Each endpoint represents a single
-- operation (GET /users, POST /orders, etc.) that can become an MCP action.
-- -----------------------------------------------------------------------------
CREATE TABLE public.endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_source_id UUID NOT NULL REFERENCES public.api_sources(id) ON DELETE CASCADE,
  
  -- Endpoint definition
  operation_id TEXT,                     -- OpenAPI operationId
  name TEXT NOT NULL,                    -- Human-readable name
  description TEXT,
  method http_method NOT NULL,
  path TEXT NOT NULL,                    -- e.g., "/users/{id}"
  
  -- Parameters & schemas
  path_parameters JSONB,                 -- [{name, type, required, description}]
  query_parameters JSONB,
  header_parameters JSONB,
  request_body_schema JSONB,             -- JSON Schema for request body
  response_schemas JSONB,                -- {200: schema, 400: schema, ...}
  
  -- Tags for organization
  tags TEXT[],
  
  -- Status
  status resource_status NOT NULL DEFAULT 'active',
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.endpoints IS 'Individual API endpoints parsed from API sources';
COMMENT ON COLUMN public.endpoints.operation_id IS 'Original operationId from OpenAPI spec for traceability';

-- -----------------------------------------------------------------------------
-- ACTION_TEMPLATES: MCP action definitions generated from endpoints
-- -----------------------------------------------------------------------------
-- Templates define how endpoints are exposed as MCP tools to AI agents.
-- Users can customize the action name, description, and parameter mappings.
-- -----------------------------------------------------------------------------
CREATE TABLE public.action_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES public.endpoints(id) ON DELETE SET NULL,
  
  -- Action definition for MCP
  name TEXT NOT NULL,                    -- MCP tool name (e.g., "get_user")
  description TEXT NOT NULL,             -- Description shown to AI agents
  
  -- Parameter configuration
  input_schema JSONB NOT NULL,           -- JSON Schema for tool input
  output_schema JSONB,                   -- Expected output schema
  
  -- Execution configuration
  timeout_ms INTEGER DEFAULT 30000,      -- Max execution time
  retry_config JSONB,                    -- {max_retries, backoff_ms}
  
  -- Rate limiting
  rate_limit_requests INTEGER,           -- Requests per window
  rate_limit_window_seconds INTEGER,     -- Window size
  
  -- Status & visibility
  status resource_status NOT NULL DEFAULT 'active',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.action_templates IS 'MCP action definitions that expose endpoints as AI agent tools';
COMMENT ON COLUMN public.action_templates.requires_approval IS 'If true, executions need human approval before running';

-- -----------------------------------------------------------------------------
-- MCP_EXPORTS: Versioned MCP configuration exports
-- -----------------------------------------------------------------------------
-- Tracks exported MCP configurations with versioning. Each export is immutable
-- and contains the complete MCP manifest for reproducibility.
-- -----------------------------------------------------------------------------
CREATE TABLE public.mcp_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Version information
  version TEXT NOT NULL,                 -- Semantic version (e.g., "1.0.0")
  version_number INTEGER NOT NULL,       -- Auto-incrementing version number
  release_notes TEXT,
  
  -- Export content (immutable snapshot)
  mcp_manifest JSONB NOT NULL,           -- Complete MCP configuration
  included_actions UUID[],               -- Action template IDs included
  
  -- Export metadata
  format TEXT NOT NULL DEFAULT 'json',   -- json, typescript
  file_size_bytes INTEGER,
  checksum TEXT,                         -- SHA256 of exported content
  
  -- Status
  status resource_status NOT NULL DEFAULT 'active',
  is_latest BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit fields
  exported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mcp_exports IS 'Versioned MCP configuration exports for deployment and distribution';
COMMENT ON COLUMN public.mcp_exports.mcp_manifest IS 'Complete MCP config snapshot - immutable after creation';

-- -----------------------------------------------------------------------------
-- PERMISSION_POLICIES: Fine-grained access control for agents and users
-- -----------------------------------------------------------------------------
-- Defines who (users, roles, or AI agents) can access which resources
-- and perform which actions. Supports conditions for dynamic policies.
-- -----------------------------------------------------------------------------
CREATE TABLE public.permission_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Policy metadata
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,   -- Higher = evaluated first
  
  -- Subject: WHO this policy applies to
  -- Can target: specific user, role, agent, or wildcards
  subject_type TEXT NOT NULL,            -- 'user', 'role', 'agent', 'all'
  subject_id UUID,                       -- Specific user/agent ID (null for role/all)
  subject_role app_role,                 -- Role if subject_type = 'role'
  
  -- Resource: WHAT this policy controls access to
  resource_type TEXT NOT NULL,           -- 'project', 'action', 'endpoint', etc.
  resource_id UUID,                      -- Specific resource (null = all of type)
  
  -- Action: WHAT operations are controlled
  allowed_actions TEXT[] NOT NULL,       -- ['read', 'execute', 'update', etc.]
  
  -- Effect: allow or deny
  effect policy_effect NOT NULL DEFAULT 'allow',
  
  -- Conditions: WHEN this policy applies (optional)
  conditions JSONB,                      -- {time_range, ip_whitelist, etc.}
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.permission_policies IS 'Fine-grained access control policies for users and AI agents';
COMMENT ON COLUMN public.permission_policies.conditions IS 'Dynamic conditions: time ranges, IP restrictions, etc.';

-- -----------------------------------------------------------------------------
-- APPROVAL_POLICIES: Define when human approval is required
-- -----------------------------------------------------------------------------
-- Configures which actions or conditions require human approval before
-- execution. Essential for high-risk operations in production.
-- -----------------------------------------------------------------------------
CREATE TABLE public.approval_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Policy metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- What triggers approval requirement
  trigger_type TEXT NOT NULL,            -- 'action', 'threshold', 'schedule', 'condition'
  trigger_config JSONB NOT NULL,         -- {action_ids, amount_threshold, etc.}
  
  -- Who can approve
  approver_roles app_role[] NOT NULL,    -- Roles that can approve
  approver_users UUID[],                 -- Specific users (optional)
  
  -- Approval settings
  required_approvals INTEGER NOT NULL DEFAULT 1,
  timeout_hours INTEGER DEFAULT 24,
  auto_reject_on_timeout BOOLEAN NOT NULL DEFAULT true,
  
  -- Notification settings
  notification_channels JSONB,           -- {email, slack_webhook, etc.}
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approval_policies IS 'Policies defining when human approval is required for actions';

-- -----------------------------------------------------------------------------
-- APPROVAL_REQUESTS: Individual approval requests
-- -----------------------------------------------------------------------------
CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.approval_policies(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- What needs approval
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  request_data JSONB,                    -- Context for the approval
  
  -- Status
  status approval_status NOT NULL DEFAULT 'pending',
  
  -- Approvals received
  approvals JSONB DEFAULT '[]',          -- [{user_id, approved_at, comment}]
  rejections JSONB DEFAULT '[]',
  
  -- Timing
  expires_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approval_requests IS 'Individual approval requests pending human review';

-- -----------------------------------------------------------------------------
-- EXECUTION_RUNS: Track all action executions for audit & debugging
-- -----------------------------------------------------------------------------
-- Comprehensive log of every action execution, including inputs, outputs,
-- timing, and any errors. Critical for debugging and compliance.
-- -----------------------------------------------------------------------------
CREATE TABLE public.execution_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action_template_id UUID REFERENCES public.action_templates(id) ON DELETE SET NULL,
  
  -- Execution context
  environment environment_type NOT NULL DEFAULT 'development',
  triggered_by TEXT NOT NULL,            -- 'user', 'agent', 'schedule', 'webhook'
  triggered_by_id UUID,                  -- User or agent ID
  agent_session_id TEXT,                 -- For tracking agent conversations
  
  -- Request details
  input_parameters JSONB,
  headers_sent JSONB,                    -- Sanitized (no secrets)
  
  -- Response details
  status execution_status NOT NULL DEFAULT 'pending',
  output_data JSONB,
  error_message TEXT,
  error_details JSONB,
  
  -- Timing metrics
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Approval tracking (if required)
  approval_request_id UUID REFERENCES public.approval_requests(id),
  
  -- Rate limiting & retries
  attempt_number INTEGER NOT NULL DEFAULT 1,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.execution_runs IS 'Complete audit trail of all action executions';
COMMENT ON COLUMN public.execution_runs.agent_session_id IS 'Links executions within the same AI agent conversation';

-- Index for efficient queries on execution history
CREATE INDEX idx_execution_runs_org_created ON public.execution_runs(organization_id, created_at DESC);
CREATE INDEX idx_execution_runs_project_status ON public.execution_runs(project_id, status);
CREATE INDEX idx_execution_runs_agent_session ON public.execution_runs(agent_session_id) WHERE agent_session_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- SECRETS: Encrypted storage for API keys and credentials
-- -----------------------------------------------------------------------------
-- Stores encrypted secrets for API authentication. Secrets are scoped to
-- environments (dev/staging/prod) and projects.
-- NOTE: In production, integrate with a proper secrets manager (Vault, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE public.secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Secret metadata
  name TEXT NOT NULL,                    -- e.g., "STRIPE_API_KEY"
  description TEXT,
  
  -- Scoping
  environment environment_type,          -- NULL = all environments
  
  -- Value (should be encrypted at rest by Supabase)
  -- In production, consider using Vault integration
  encrypted_value TEXT NOT NULL,
  
  -- Versioning for rotation
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES public.secrets(id),
  
  -- Expiry & rotation
  expires_at TIMESTAMP WITH TIME ZONE,
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  rotation_reminder_days INTEGER,
  
  -- Access tracking
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one active secret per name/project/environment
  UNIQUE NULLS NOT DISTINCT (organization_id, project_id, name, environment, is_active)
);

COMMENT ON TABLE public.secrets IS 'Encrypted storage for API keys and credentials';
COMMENT ON COLUMN public.secrets.encrypted_value IS 'Encrypted secret value - use application-level encryption';

-- -----------------------------------------------------------------------------
-- ENVIRONMENT_CONFIGS: Environment-specific settings
-- -----------------------------------------------------------------------------
-- Configuration for different deployment environments (dev, staging, prod).
-- Includes base URLs, feature flags, and environment-specific overrides.
-- -----------------------------------------------------------------------------
CREATE TABLE public.environment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Environment
  environment environment_type NOT NULL,
  
  -- Base configuration
  name TEXT NOT NULL,                    -- Display name (e.g., "Production")
  base_url TEXT,                         -- API base URL for this environment
  
  -- Feature flags
  features JSONB DEFAULT '{}',           -- {feature_name: enabled}
  
  -- Rate limits (can override action-level limits)
  global_rate_limit_requests INTEGER,
  global_rate_limit_window_seconds INTEGER,
  
  -- Timeouts
  default_timeout_ms INTEGER DEFAULT 30000,
  
  -- Headers to include in all requests
  default_headers JSONB DEFAULT '{}',
  
  -- Logging level
  log_level TEXT DEFAULT 'info',         -- debug, info, warn, error
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One config per environment per project
  UNIQUE (project_id, environment)
);

COMMENT ON TABLE public.environment_configs IS 'Environment-specific configuration (dev, staging, prod)';

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- All policies use security definer functions to prevent recursion.
-- Pattern: Users can only access data belonging to their organization.
-- =============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.api_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_configs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- HELPER FUNCTION: Check if user can access a project
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND public.is_org_member(_user_id, p.organization_id)
  )
$$;

COMMENT ON FUNCTION public.can_access_project IS 'Check if user has access to a project via org membership';

-- -----------------------------------------------------------------------------
-- HELPER FUNCTION: Check if user has specific role in project's org
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_project_org_role(_user_id UUID, _project_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_org_role(_user_id, p.organization_id)
  FROM public.projects p
  WHERE p.id = _project_id
$$;

COMMENT ON FUNCTION public.get_project_org_role IS 'Get user role in the organization that owns a project';

-- -----------------------------------------------------------------------------
-- API_SOURCES POLICIES
-- -----------------------------------------------------------------------------

-- SELECT: Members can view API sources in their projects
CREATE POLICY "Members can view api_sources"
ON public.api_sources FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

-- INSERT: Members can create API sources
CREATE POLICY "Members can create api_sources"
ON public.api_sources FOR INSERT
WITH CHECK (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin', 'member')
);

-- UPDATE: Members can update API sources
CREATE POLICY "Members can update api_sources"
ON public.api_sources FOR UPDATE
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin', 'member')
);

-- DELETE: Admins can delete API sources
CREATE POLICY "Admins can delete api_sources"
ON public.api_sources FOR DELETE
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- ENDPOINTS POLICIES (access via api_source -> project)
-- -----------------------------------------------------------------------------

-- Helper to check endpoint access
CREATE OR REPLACE FUNCTION public.can_access_endpoint(_user_id UUID, _endpoint_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.endpoints e
    JOIN public.api_sources s ON s.id = e.api_source_id
    WHERE e.id = _endpoint_id
      AND public.can_access_project(_user_id, s.project_id)
  )
$$;

-- SELECT: Members can view endpoints
CREATE POLICY "Members can view endpoints"
ON public.endpoints FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.api_sources s
    WHERE s.id = api_source_id
      AND public.can_access_project(auth.uid(), s.project_id)
  )
);

-- INSERT/UPDATE: Members can manage endpoints
CREATE POLICY "Members can manage endpoints"
ON public.endpoints FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.api_sources s
    WHERE s.id = api_source_id
      AND public.get_project_org_role(auth.uid(), s.project_id) IN ('owner', 'admin', 'member')
  )
);

-- -----------------------------------------------------------------------------
-- ACTION_TEMPLATES POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view action_templates"
ON public.action_templates FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Members can create action_templates"
ON public.action_templates FOR INSERT
WITH CHECK (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin', 'member')
);

CREATE POLICY "Members can update action_templates"
ON public.action_templates FOR UPDATE
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin', 'member')
);

CREATE POLICY "Admins can delete action_templates"
ON public.action_templates FOR DELETE
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- MCP_EXPORTS POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view mcp_exports"
ON public.mcp_exports FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Members can create mcp_exports"
ON public.mcp_exports FOR INSERT
WITH CHECK (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin', 'member')
);

-- Exports are immutable - no UPDATE policy

CREATE POLICY "Admins can delete mcp_exports"
ON public.mcp_exports FOR DELETE
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- PERMISSION_POLICIES POLICIES (org-level)
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view permission_policies"
ON public.permission_policies FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage permission_policies"
ON public.permission_policies FOR ALL
USING (
  public.get_org_role(auth.uid(), organization_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- APPROVAL_POLICIES POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view approval_policies"
ON public.approval_policies FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage approval_policies"
ON public.approval_policies FOR ALL
USING (
  public.get_org_role(auth.uid(), organization_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- APPROVAL_REQUESTS POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view approval_requests"
ON public.approval_requests FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Anyone can create approval requests (system/automation)
CREATE POLICY "Authenticated can create approval_requests"
ON public.approval_requests FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Approvers can update (approve/reject) requests
CREATE POLICY "Approvers can update approval_requests"
ON public.approval_requests FOR UPDATE
USING (
  public.get_org_role(auth.uid(), organization_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- EXECUTION_RUNS POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view execution_runs"
ON public.execution_runs FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Members can create execution runs
CREATE POLICY "Members can create execution_runs"
ON public.execution_runs FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Only system can update execution runs (via service role)
-- No UPDATE policy for regular users - status updates via backend

-- -----------------------------------------------------------------------------
-- SECRETS POLICIES (extra restrictive)
-- -----------------------------------------------------------------------------
-- Secrets are highly sensitive - only admins can manage them.
-- Note: Reading secrets should typically go through a backend function
-- that decrypts and injects them, not direct table access.
-- -----------------------------------------------------------------------------

CREATE POLICY "Admins can view secrets metadata"
ON public.secrets FOR SELECT
USING (
  public.get_org_role(auth.uid(), organization_id) 
  IN ('owner', 'admin')
);

CREATE POLICY "Admins can manage secrets"
ON public.secrets FOR ALL
USING (
  public.get_org_role(auth.uid(), organization_id) 
  IN ('owner', 'admin')
);

-- -----------------------------------------------------------------------------
-- ENVIRONMENT_CONFIGS POLICIES
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view environment_configs"
ON public.environment_configs FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Admins can manage environment_configs"
ON public.environment_configs FOR ALL
USING (
  public.get_project_org_role(auth.uid(), project_id) 
  IN ('owner', 'admin')
);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE TRIGGER update_api_sources_updated_at 
  BEFORE UPDATE ON public.api_sources 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_endpoints_updated_at 
  BEFORE UPDATE ON public.endpoints 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_templates_updated_at 
  BEFORE UPDATE ON public.action_templates 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permission_policies_updated_at 
  BEFORE UPDATE ON public.permission_policies 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_policies_updated_at 
  BEFORE UPDATE ON public.approval_policies 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_secrets_updated_at 
  BEFORE UPDATE ON public.secrets 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_environment_configs_updated_at 
  BEFORE UPDATE ON public.environment_configs 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX idx_api_sources_project ON public.api_sources(project_id);
CREATE INDEX idx_endpoints_api_source ON public.endpoints(api_source_id);
CREATE INDEX idx_action_templates_project ON public.action_templates(project_id);
CREATE INDEX idx_action_templates_endpoint ON public.action_templates(endpoint_id);
CREATE INDEX idx_mcp_exports_project ON public.mcp_exports(project_id, created_at DESC);
CREATE INDEX idx_permission_policies_org ON public.permission_policies(organization_id);
CREATE INDEX idx_approval_policies_org ON public.approval_policies(organization_id);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(organization_id, status);
CREATE INDEX idx_secrets_org_project ON public.secrets(organization_id, project_id);
CREATE INDEX idx_environment_configs_project ON public.environment_configs(project_id);