-- Drop the restrictive INSERT policy on organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create a PERMISSIVE INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);