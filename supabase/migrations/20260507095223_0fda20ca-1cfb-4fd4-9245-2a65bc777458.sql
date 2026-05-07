
-- 1. agent_api_keys: restrict SELECT to admins/owners only
DROP POLICY IF EXISTS "Members can view agent_api_keys" ON public.agent_api_keys;
CREATE POLICY "Admins can view agent_api_keys"
  ON public.agent_api_keys
  FOR SELECT
  TO authenticated
  USING (get_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

-- 2. api_connectors: restrict SELECT to admins/owners only
DROP POLICY IF EXISTS "Members can view api_connectors" ON public.api_connectors;
CREATE POLICY "Admins can view api_connectors"
  ON public.api_connectors
  FOR SELECT
  TO authenticated
  USING (get_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

-- 3. profiles: restrict to authenticated role explicitly (block anon access)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org members can view co-member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Org members can view co-member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.user_id
  ));

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
