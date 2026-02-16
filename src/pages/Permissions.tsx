/**
 * Permissions page for MCP Foundry
 * User RBAC/ABAC with agent scoping
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, History, Loader2 } from "lucide-react";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import { UserPermissionsPanel } from "@/components/permissions/UserPermissionsPanel";
import { PermissionEvaluationLogs } from "@/components/permissions/PermissionEvaluationLogs";
import { supabase } from "@/integrations/supabase/client";

export default function Permissions() {
  const { currentProject, projects, isLoading: projectLoading } = useCurrentProject();
  const [activeTab, setActiveTab] = useState("user");

  // Build agents list from projects for the scope selector
  const agents = projects.map((p) => ({ id: p.id, name: p.name }));

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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="user" className="gap-2">
                <Users className="h-4 w-4" />
                User Permissions
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2">
                <History className="h-4 w-4" />
                Audit Logs
              </TabsTrigger>
            </TabsList>

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
                          Rules can be scoped to a specific agent for fine-grained control.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {currentProject && (
                  <UserPermissionsPanel
                    organizationId={currentProject.organization_id}
                    agents={agents}
                  />
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
