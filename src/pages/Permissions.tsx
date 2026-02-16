/**
 * Permissions page — Agent-centric operator role permissions
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, History, Loader2, Bot, Shield } from "lucide-react";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import { UserPermissionsPanel } from "@/components/permissions/UserPermissionsPanel";
import { PermissionEvaluationLogs } from "@/components/permissions/PermissionEvaluationLogs";

export default function Permissions() {
  const { currentProject, projects, isLoading: projectLoading } = useCurrentProject();
  const [activeTab, setActiveTab] = useState("user");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Use projects as agents list
  const agents = projects.map((p) => ({ id: p.id, name: p.name }));

  // Auto-select first agent
  if (!selectedAgentId && agents.length > 0) {
    setSelectedAgentId(agents[0].id);
  }

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
    <DashboardLayout title="Permissions" description="Gérer les droits des opérateurs par agent">
      <ProjectBanner>
        <div className="space-y-6">
          {/* Agent selector */}
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Sélectionner un agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="user" className="gap-2">
                <Shield className="h-4 w-4" />
                Permissions par rôle
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
                        <p className="text-sm font-medium">Permissions des opérateurs</p>
                        <p className="text-sm text-muted-foreground">
                          Configurez les actions autorisées pour chaque rôle d'opérateur de cet agent.
                          Les rôles sont extraits des clés opérateurs existantes.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedAgentId && currentProject && (
                  <UserPermissionsPanel
                    agentId={selectedAgentId}
                    organizationId={currentProject.organization_id}
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
