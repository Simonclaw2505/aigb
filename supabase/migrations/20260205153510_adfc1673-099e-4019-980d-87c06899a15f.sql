-- Create enum types
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.project_status AS ENUM ('draft', 'active', 'archived');

-- Organizations table (multi-tenant)
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization members (join table)
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- User roles table (for admin privileges)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'draft',
  openapi_spec JSONB,
  mcp_config JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- API Actions (generated from OpenAPI)
CREATE TABLE public.api_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  parameters JSONB,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions for actions
CREATE TABLE public.action_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.api_actions(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  can_execute BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit logs table (critical for compliance)
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check organization membership
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get org role
CREATE OR REPLACE FUNCTION public.get_org_role(_user_id UUID, _org_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = _user_id AND organization_id = _org_id
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Organizations policies
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners can update organizations"
ON public.organizations FOR UPDATE
USING (public.get_org_role(auth.uid(), id) = 'owner');

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Organization members policies
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage members"
ON public.organization_members FOR ALL
USING (public.get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Users can insert themselves as members"
ON public.organization_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view their roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Members can view projects"
ON public.projects FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can create projects"
ON public.projects FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can update projects"
ON public.projects FOR UPDATE
USING (public.get_org_role(auth.uid(), organization_id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE
USING (public.get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- API Actions policies
CREATE POLICY "Members can view actions"
ON public.api_actions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_id AND public.is_org_member(auth.uid(), p.organization_id)
));

CREATE POLICY "Members can manage actions"
ON public.api_actions FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_id AND public.get_org_role(auth.uid(), p.organization_id) IN ('owner', 'admin', 'member')
));

-- Action permissions policies
CREATE POLICY "Members can view permissions"
ON public.action_permissions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.api_actions a
  JOIN public.projects p ON p.id = a.project_id
  WHERE a.id = action_id AND public.is_org_member(auth.uid(), p.organization_id)
));

CREATE POLICY "Admins can manage permissions"
ON public.action_permissions FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.api_actions a
  JOIN public.projects p ON p.id = a.project_id
  WHERE a.id = action_id AND public.get_org_role(auth.uid(), p.organization_id) IN ('owner', 'admin')
));

-- Audit logs policies
CREATE POLICY "Members can view org audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_actions_updated_at BEFORE UPDATE ON public.api_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Index for audit logs performance
CREATE INDEX idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_projects_org ON public.projects(organization_id);
CREATE INDEX idx_api_actions_project ON public.api_actions(project_id);