
-- API Connectors: store connection configurations for external APIs
CREATE TABLE public.api_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  api_source_id UUID REFERENCES public.api_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key', -- 'api_key', 'oauth2', 'bearer', 'basic', 'none'
  auth_config JSONB DEFAULT '{}', -- Non-sensitive config like header names, oauth endpoints
  -- Credentials stored as references to secrets table
  credential_secret_id UUID REFERENCES public.secrets(id) ON DELETE SET NULL,
  oauth_refresh_secret_id UUID REFERENCES public.secrets(id) ON DELETE SET NULL,
  -- Connection settings
  default_headers JSONB DEFAULT '{}',
  timeout_ms INTEGER DEFAULT 30000,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000, "backoff_multiplier": 2}',
  rate_limit_requests INTEGER,
  rate_limit_window_seconds INTEGER DEFAULT 60,
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution runs enhancement: add more metadata for robust tracking
ALTER TABLE public.execution_runs 
  ADD COLUMN IF NOT EXISTS connector_id UUID REFERENCES public.api_connectors(id),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS request_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS redacted_request JSONB,
  ADD COLUMN IF NOT EXISTS redacted_response JSONB,
  ADD COLUMN IF NOT EXISTS diff_summary JSONB;

-- Create unique index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_runs_idempotency 
  ON public.execution_runs(action_template_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Enable RLS
ALTER TABLE public.api_connectors ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_connectors
CREATE POLICY "Admins can manage api_connectors"
ON public.api_connectors FOR ALL
USING (get_project_org_role(auth.uid(), project_id) IN ('owner', 'admin'));

CREATE POLICY "Members can view api_connectors"
ON public.api_connectors FOR SELECT
USING (can_access_project(auth.uid(), project_id));

-- Indexes
CREATE INDEX idx_api_connectors_project ON public.api_connectors(project_id);
CREATE INDEX idx_api_connectors_api_source ON public.api_connectors(api_source_id);
CREATE INDEX idx_execution_runs_connector ON public.execution_runs(connector_id);
CREATE INDEX idx_execution_runs_idempotency_key ON public.execution_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_api_connectors_updated_at
  BEFORE UPDATE ON public.api_connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
