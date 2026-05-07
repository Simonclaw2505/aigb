/**
 * User Permissions Panel — Agent-centric role/tool/action matrix
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, Wrench, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useAgentRoles,
  useAgentToolsAndActions,
  useAgentPermissionRules,
} from "@/hooks/useAgentPermissions";
import type { Database } from "@/integrations/supabase/types";
import { ConfirmActionDialog } from "@/components/simulator/ConfirmActionDialog";
import { supabase } from "@/integrations/supabase/client";

interface PendingChange {
  role: AppRole;
  actionId: string;
  actionName: string;
  riskLevel: string;
  toAllow: boolean;
}

const isCritical = (risk: string, currentlyAllowed: boolean) => {
  // Granting a high/critical action OR revoking any non-read action requires confirmation
  if (risk === "critical" || risk === "high") return true;
  if (currentlyAllowed && risk !== "read_only" && risk !== "low") return true;
  return false;
};

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserPermissionsPanelProps {
  agentId: string;
  organizationId: string;
}

const roleBadgeVariant = (role: AppRole) => {
  switch (role) {
    case "owner": return "default";
    case "admin": return "default";
    case "member": return "secondary";
    case "viewer": return "outline";
    default: return "outline";
  }
};

const riskBadge = (risk: string) => {
  switch (risk) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    default: return "outline";
  }
};

export function UserPermissionsPanel({ agentId, organizationId }: UserPermissionsPanelProps) {
  const { roles, loading: rolesLoading } = useAgentRoles(agentId);
  const { tools, loading: toolsLoading } = useAgentToolsAndActions(agentId);
  const { isAllowed, togglePermission, loading: permsLoading } = useAgentPermissionRules(agentId, organizationId);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const handleToggle = (role: AppRole, actionId: string, actionName: string, riskLevel: string, checked: boolean) => {
    const currentlyAllowed = isAllowed(role, actionId);
    if (isCritical(riskLevel, currentlyAllowed)) {
      setPendingChange({ role, actionId, actionName, riskLevel, toAllow: checked });
      return;
    }
    void togglePermission(role, actionId, actionName, checked);
  };

  const confirmChange = async (operatorInfo?: { operator_id: string; operator_name: string; role: string }) => {
    if (!pendingChange) return;
    await togglePermission(pendingChange.role, pendingChange.actionId, pendingChange.actionName, pendingChange.toAllow);
    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        user_id: user?.id ?? null,
        resource_type: "permission_rule",
        resource_id: pendingChange.actionId,
        action: pendingChange.toAllow ? "permission.grant" : "permission.revoke",
        metadata: {
          agent_id: agentId,
          role: pendingChange.role,
          action_name: pendingChange.actionName,
          risk_level: pendingChange.riskLevel,
          confirmed_by_operator: operatorInfo ?? null,
        },
      });
    } catch {
      // non-blocking
    }
    setPendingChange(null);
  };

  const loading = rolesLoading || toolsLoading || permsLoading;

  const toggleExpanded = (role: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun rôle opérateur trouvé pour cet agent.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajoutez des opérateurs depuis la page Agents pour configurer les permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (tools.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun outil avec des actions configurées pour cet agent.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Liez des outils et créez des actions depuis les pages Outils et Actions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Cochez les actions autorisées pour chaque rôle opérateur. Seules les actions validées pour cet agent apparaissent, groupées par outil.
            </p>
          </div>
        </CardContent>
      </Card>

      {roles.map((role) => {
        const isExpanded = expandedRoles.has(role);
        return (
          <Collapsible key={role} open={isExpanded} onOpenChange={() => toggleExpanded(role)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant={roleBadgeVariant(role)} className="capitalize text-sm">
                        {role}
                      </Badge>
                      <CardDescription className="text-xs">
                        {tools.reduce((sum, t) => sum + t.actions.length, 0)} actions disponibles
                      </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tools.reduce((sum, t) => {
                        return sum + t.actions.filter((a) => isAllowed(role, a.id)).length;
                      }, 0)} autorisées
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4">
                  <div className="space-y-4">
                    {tools.map((tool) => (
                      <div key={tool.toolId} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{tool.toolName}</span>
                          <Badge variant="outline" className="text-xs">
                            {tool.actions.length} actions
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {tool.actions.map((action) => {
                            const allowed = isAllowed(role, action.id);
                            return (
                              <label
                                key={action.id}
                                className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                              >
                                <Checkbox
                                  checked={allowed}
                                  onCheckedChange={(checked) => {
                                    handleToggle(role, action.id, action.name, action.risk_level, !!checked);
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono">{action.name}</span>
                                    <Badge variant={riskBadge(action.risk_level)} className="text-[10px] px-1.5 py-0">
                                      {action.risk_level}
                                    </Badge>
                                  </div>
                                  {action.description && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {action.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {pendingChange && (
        <ConfirmActionDialog
          open={!!pendingChange}
          onOpenChange={(o) => { if (!o) setPendingChange(null); }}
          onConfirm={(opInfo) => confirmChange(opInfo)}
          onCancel={() => setPendingChange(null)}
          stepNumber={1}
          actionName={`${pendingChange.toAllow ? "Autoriser" : "Révoquer"} « ${pendingChange.actionName} » pour le rôle ${pendingChange.role}`}
          description={
            pendingChange.toAllow
              ? `Tous les opérateurs avec le rôle « ${pendingChange.role} » pourront exécuter cette action (risque : ${pendingChange.riskLevel}).`
              : `Les opérateurs « ${pendingChange.role} » ne pourront plus exécuter cette action.`
          }
          estimatedImpact={
            pendingChange.toAllow
              ? "Élargit les droits d'exécution. Action sensible, requiert votre identification opérateur."
              : "Restreint les droits. Les exécutions en cours peuvent échouer."
          }
          requiresOperatorKey
          agentId={agentId}
        />
      )}
    </div>
  );
}
