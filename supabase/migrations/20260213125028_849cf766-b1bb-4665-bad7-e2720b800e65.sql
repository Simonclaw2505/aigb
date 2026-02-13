
-- Table to store landing page sign-ups (prospects)
CREATE TABLE public.prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('enterprise', 'individual')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  job_title TEXT,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow anyone (anon) to insert prospects from the landing page
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a prospect"
  ON public.prospects
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated org members can read prospects
CREATE POLICY "Authenticated users can read prospects"
  ON public.prospects
  FOR SELECT
  USING (auth.role() = 'authenticated');
