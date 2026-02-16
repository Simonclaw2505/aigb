
-- Add agent capability fields directly to action_templates
ALTER TABLE public.action_templates
  ADD COLUMN IF NOT EXISTS max_executions_per_hour integer,
  ADD COLUMN IF NOT EXISTS max_executions_per_day integer,
  ADD COLUMN IF NOT EXISTS allowed_environments environment_type[] NOT NULL DEFAULT ARRAY['development'::environment_type, 'staging'::environment_type, 'production'::environment_type],
  ADD COLUMN IF NOT EXISTS agent_policy agent_capability_policy NOT NULL DEFAULT 'allow'::agent_capability_policy,
  ADD COLUMN IF NOT EXISTS approval_roles app_role[] NOT NULL DEFAULT ARRAY['owner'::app_role, 'admin'::app_role];
