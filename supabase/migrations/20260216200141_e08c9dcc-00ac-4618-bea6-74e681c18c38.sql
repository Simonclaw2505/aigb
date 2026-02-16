
-- Table for tracking PIN brute-force attempts
CREATE TABLE public.pin_attempt_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet
);

-- Enable RLS
ALTER TABLE public.pin_attempt_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from edge functions)
CREATE POLICY "Service can insert pin attempts"
  ON public.pin_attempt_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can view their org's attempts
CREATE POLICY "Admins can view pin attempts"
  ON public.pin_attempt_logs
  FOR SELECT
  USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- No update or delete allowed
-- Index for fast lookups during brute-force check
CREATE INDEX idx_pin_attempts_user_time
  ON public.pin_attempt_logs (user_id, attempted_at DESC);
