-- =============================================================================
-- ACTION BUILDER ENHANCEMENT
-- Add risk levels, examples, constraints, and idempotency support
-- =============================================================================

-- Risk level enum for actions
CREATE TYPE public.action_risk_level AS ENUM (
  'read_only',      -- No data modification (GET requests)
  'safe_write',     -- Reversible writes with low impact
  'risky_write',    -- Significant changes that need care
  'irreversible'    -- Cannot be undone (deletes, financial transactions)
);

-- Add new columns to action_templates
ALTER TABLE public.action_templates 
  ADD COLUMN IF NOT EXISTS risk_level action_risk_level NOT NULL DEFAULT 'read_only',
  ADD COLUMN IF NOT EXISTS examples JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS constraints JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_idempotent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key_path TEXT,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endpoint_method TEXT,
  ADD COLUMN IF NOT EXISTS endpoint_path TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.action_templates.risk_level IS 'Risk classification for agent decision-making';
COMMENT ON COLUMN public.action_templates.examples IS 'Array of example prompts that would trigger this action: [{prompt, expected_params}]';
COMMENT ON COLUMN public.action_templates.constraints IS 'Execution constraints: {rate_limit, max_rows, allowed_fields, forbidden_fields, etc}';
COMMENT ON COLUMN public.action_templates.is_idempotent IS 'Whether the action can be safely retried without side effects';
COMMENT ON COLUMN public.action_templates.idempotency_key_path IS 'JSON path to extract idempotency key from input';
COMMENT ON COLUMN public.action_templates.auto_generated IS 'True if action was auto-generated from endpoint';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_action_templates_risk ON public.action_templates(risk_level);
CREATE INDEX IF NOT EXISTS idx_action_templates_version ON public.action_templates(project_id, version DESC);