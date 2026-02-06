-- Force drop and recreate with explicit settings
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create INSERT policy with all explicit settings
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Trigger schema reload
SELECT pg_notify('pgrst', 'reload schema');