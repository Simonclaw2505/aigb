/**
 * Permissions page for MCP Foundry
 * Two-layer permissions: Agent capabilities + User RBAC/ABAC
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Bot, Users, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AgentCapabilitiesPanel } from "@/components/permissions/AgentCapabilitiesPanel";
import { UserPermissionsPanel } from "@/components/permissions/UserPermissionsPanel";
import { PermissionEvaluationLogs } from "@/components/permissions/PermissionEvaluationLogs";

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  risk_level: string;
}

export default function Permissions() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [actionTemplates, setActionTemplates] = useState<ActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("agent");

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, organization_id")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProject(data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  // Fetch action templates for selected project
  useEffect(() => {
    const fetchActionTemplates = async () => {
      if (!selectedProject) {
        setActionTemplates([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("action_templates")
          .select("id, name, description, risk_level")
          .eq("project_id", selectedProject.id)
          .eq("is_enabled", true)
          .order("name");

        if (error) throw error;
        setActionTemplates(data || []);
      } catch (err) {
        console.error("Failed to fetch action templates:", err);
      }
    };

    fetchActionTemplates();
  }, [selectedProject]);

  if (loading) {
    return (
      <DashboardLayout title="Permissions" description="Configure access control for actions">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (projects.length === 0) {
    return (
      <DashboardLayout title="Permissions" description="Configure access control for actions">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create a project first to configure permissions
            </p>
            <Button variant="outline" asChild>
              <a href="/projects">Go to Projects</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Permissions" description="Configure role-based access for actions">
      <div className="space-y-6">
        {/* Project selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select
              value={selectedProject?.id}
              onValueChange={(id) => {
                const project = projects.find(p => p.id === id);
                setSelectedProject(project || null);
              }}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {actionTemplates.length} actions
            </Badge>
          </div>
        </div>

        {/* Two-layer permissions tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agent" className="gap-2">
              <Bot className="h-4 w-4" />
              Agent Capabilities
            </TabsTrigger>
            <TabsTrigger value="user" className="gap-2">
              <Users className="h-4 w-4" />
              User Permissions
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Bot className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Agent Capability Layer</p>
                      <p className="text-sm text-muted-foreground">
                        Control what the AI agent can do globally in this project. 
                        Set policies like <Badge variant="secondary" className="mx-1">Allow</Badge>, 
                        <Badge variant="secondary" className="mx-1">Deny</Badge>, 
                        <Badge variant="secondary" className="mx-1">Require Confirmation</Badge>, or 
                        <Badge variant="secondary" className="mx-1">Require Approval</Badge> for each action.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedProject && (
                <AgentCapabilitiesPanel
                  projectId={selectedProject.id}
                  actionTemplates={actionTemplates}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="user" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">User Permission Layer</p>
                      <p className="text-sm text-muted-foreground">
                        Configure role-based access control (RBAC) and attribute-based rules (ABAC). 
                        Define which roles can perform which actions, with optional conditions like 
                        <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">region == user.region</code> or 
                        <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">amount &lt;= 10000</code>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedProject && (
                <UserPermissionsPanel organizationId={selectedProject.organization_id} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <History className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Permission Audit Trail</p>
                      <p className="text-sm text-muted-foreground">
                        Every permission evaluation is logged for compliance and debugging. 
                        See which rules matched, whether confirmation or approval was required, and the final decision.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedProject && (
                <PermissionEvaluationLogs organizationId={selectedProject.organization_id} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
