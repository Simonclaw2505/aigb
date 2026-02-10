/**
 * Permissions page for MCP Foundry
 * Two-layer permissions: Agent capabilities + User RBAC/ABAC
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Bot, Users, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import { AgentCapabilitiesPanel } from "@/components/permissions/AgentCapabilitiesPanel";
import { UserPermissionsPanel } from "@/components/permissions/UserPermissionsPanel";
import { PermissionEvaluationLogs } from "@/components/permissions/PermissionEvaluationLogs";

interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  risk_level: string;
}

export default function Permissions() {
  const { currentProject, isLoading: projectLoading } = useCurrentProject();
  const [actionTemplates, setActionTemplates] = useState<ActionTemplate[]>([]);
  const [activeTab, setActiveTab] = useState("agent");

  // Fetch action templates for current project
  useEffect(() => {
    const fetchActionTemplates = async () => {
      if (!currentProject) {
        setActionTemplates([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("action_templates")
          .select("id, name, description, risk_level")
          .eq("project_id", currentProject.id)
          .eq("is_enabled", true)
          .order("name");

        if (error) throw error;
        setActionTemplates(data || []);
      } catch (err) {
        console.error("Failed to fetch action templates:", err);
      }
    };

    fetchActionTemplates();
  }, [currentProject]);

  if (projectLoading) {
    return (
      <DashboardLayout title="Permissions" description="Configure access control for actions">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Permissions" description="Configure role-based access for actions">
      <ProjectBanner>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {actionTemplates.length} actions
            </Badge>
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

                {currentProject && (
                  <AgentCapabilitiesPanel
                    projectId={currentProject.id}
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

                {currentProject && (
                  <UserPermissionsPanel organizationId={currentProject.organization_id} />
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

                {currentProject && (
                  <PermissionEvaluationLogs organizationId={currentProject.organization_id} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ProjectBanner>
    </DashboardLayout>
  );
}
