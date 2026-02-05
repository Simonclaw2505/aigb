/**
 * Hook to manage the current project context
 * Handles fetching user's projects and creating default org/project if needed
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  organization_id: string;
  created_at: string;
}

interface UseCurrentProjectReturn {
  currentProject: Project | null;
  projects: Project[];
  organization: Organization | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  setCurrentProject: (project: Project) => void;
  createDefaultProject: (projectName: string, orgName?: string) => Promise<Project | null>;
  refetch: () => Promise<void>;
}

const CURRENT_PROJECT_KEY = "mcp_foundry_current_project_id";

export function useCurrentProject(): UseCurrentProjectReturn {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // First, get user's organization memberships
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        // User has no organization
        setOrganization(null);
        setProjects([]);
        setCurrentProjectState(null);
        setIsLoading(false);
        return;
      }

      // Get the first organization (could be extended to support multiple)
      const orgId = memberships[0].organization_id;

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (orgError) throw orgError;

      setOrganization(orgData);

      // Get projects for this organization
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      const typedProjects = (projectsData || []) as Project[];
      setProjects(typedProjects);

      // Restore current project from localStorage or use first project
      const savedProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);
      const savedProject = typedProjects.find((p) => p.id === savedProjectId);
      
      if (savedProject) {
        setCurrentProjectState(savedProject);
      } else if (typedProjects.length > 0) {
        setCurrentProjectState(typedProjects[0]);
        localStorage.setItem(CURRENT_PROJECT_KEY, typedProjects[0].id);
      } else {
        setCurrentProjectState(null);
      }
    } catch (error) {
      console.error("Error fetching project data:", error);
      toast.error("Erreur lors du chargement des projets");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setCurrentProject = useCallback((project: Project) => {
    setCurrentProjectState(project);
    localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
  }, []);

  const createDefaultProject = useCallback(
    async (projectName: string, orgName?: string): Promise<Project | null> => {
      if (!user) {
        toast.error("Vous devez être connecté");
        return null;
      }

      try {
        let orgId = organization?.id;

        // Create organization if needed
        if (!orgId) {
          const slug = (orgName || `org-${user.id.slice(0, 8)}`)
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-");

          const { data: newOrg, error: orgError } = await supabase
            .from("organizations")
            .insert({
              name: orgName || "Mon Organisation",
              slug,
            })
            .select()
            .single();

          if (orgError) throw orgError;

          // Add user as owner of the organization
          const { error: memberError } = await supabase
            .from("organization_members")
            .insert({
              organization_id: newOrg.id,
              user_id: user.id,
              role: "owner",
            });

          if (memberError) throw memberError;

          orgId = newOrg.id;
          setOrganization(newOrg);
        }

        // Create the project
        const { data: newProject, error: projectError } = await supabase
          .from("projects")
          .insert({
            name: projectName,
            organization_id: orgId,
            created_by: user.id,
            status: "draft",
          })
          .select()
          .single();

        if (projectError) throw projectError;

        const typedProject = newProject as Project;
        
        setProjects((prev) => [typedProject, ...prev]);
        setCurrentProject(typedProject);
        
        toast.success("Projet créé avec succès !");
        return typedProject;
      } catch (error: any) {
        console.error("Error creating project:", error);
        toast.error(error.message || "Erreur lors de la création du projet");
        return null;
      }
    },
    [user, organization, setCurrentProject]
  );

  const needsOnboarding = !isLoading && (!organization || projects.length === 0);

  return {
    currentProject,
    projects,
    organization,
    isLoading,
    needsOnboarding,
    setCurrentProject,
    createDefaultProject,
    refetch: fetchData,
  };
}
