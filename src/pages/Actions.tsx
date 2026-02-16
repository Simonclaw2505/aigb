/**
 * Actions page for MCP Foundry
 * Convert endpoints into agent-friendly MCP actions
 */

import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionBuilderForm, type ActionFormData } from "@/components/actions/ActionBuilderForm";
import { EndpointToActionCard } from "@/components/actions/EndpointToActionCard";
import { ActionCard } from "@/components/actions/ActionCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import {
  generateActionSuggestion,
  suggestRiskLevel,
  type RiskLevel,
} from "@/lib/action-suggestions";
import {
  Search,
  Wand2,
  Zap,
  Filter,
  Plus,
  Loader2,
  FolderOpen,
  AlertCircle,
  Wrench,
  Link as LinkIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Endpoint {
  id: string;
  name: string;
  description: string | null;
  method: string;
  path: string;
  operation_id: string | null;
  is_deprecated: boolean;
  path_parameters: any[];
  query_parameters: any[];
  header_parameters: any[];
  request_body_schema: any;
  response_schemas: any;
  tags: string[];
  sourceName?: string;
  sourceId?: string;
}

interface LinkedTool {
  id: string;
  name: string;
}

interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  risk_level: RiskLevel;
  is_enabled: boolean;
  is_idempotent: boolean;
  requires_approval: boolean;
  version: number;
  endpoint_method: string | null;
  endpoint_path: string | null;
  endpoint_id: string | null;
  input_schema: any;
  output_schema: any;
  examples: any[];
  constraints: any;
  agent_policy: string;
  approval_roles: string[];
  max_executions_per_hour: number | null;
  max_executions_per_day: number | null;
  allowed_environments: string[];
}

export default function Actions() {
  const { currentProject, isLoading: projectLoading, needsOnboarding } = useCurrentProject();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("endpoints");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [actions, setActions] = useState<ActionTemplate[]>([]);
  const [linkedTools, setLinkedTools] = useState<LinkedTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasNoLinkedTools, setHasNoLinkedTools] = useState(false);

  // Dialog state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [editingAction, setEditingAction] = useState<ActionTemplate | null>(null);

  const { toast } = useToast();

  // Fetch endpoints and actions
  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Step 1: Get linked tools via agent_tools
      const { data: agentToolsData, error: toolsError } = await supabase
        .from("agent_tools")
        .select("api_source_id, api_sources(id, name)")
        .eq("agent_id", currentProject!.id);

      if (toolsError) throw toolsError;

      const tools: LinkedTool[] = (agentToolsData || []).map((t: any) => ({
        id: t.api_source_id,
        name: t.api_sources?.name || "Unknown",
      }));
      setLinkedTools(tools);

      const sourceIds = tools.map((t) => t.id);
      setHasNoLinkedTools(sourceIds.length === 0);

      // Step 2: Fetch endpoints for linked tools only
      let endpointsList: Endpoint[] = [];
      if (sourceIds.length > 0) {
        const { data: endpointsData, error: endpointsError } = await supabase
          .from("endpoints")
          .select("*")
          .in("api_source_id", sourceIds)
          .order("created_at", { ascending: false });

        if (endpointsError) throw endpointsError;

        // Build a sourceId->name map
        const sourceNameMap: Record<string, string> = {};
        tools.forEach((t) => { sourceNameMap[t.id] = t.name; });

        endpointsList = (endpointsData || []).map((ep: any) => ({
          ...ep,
          path_parameters: ep.path_parameters || [],
          query_parameters: ep.query_parameters || [],
          header_parameters: ep.header_parameters || [],
          tags: ep.tags || [],
          sourceName: sourceNameMap[ep.api_source_id] || "Unknown",
          sourceId: ep.api_source_id,
        }));
      }
      setEndpoints(endpointsList);

      // Fetch actions filtered by current project
      const { data: actionsData, error: actionsError } = await supabase
        .from("action_templates")
        .select("*")
        .eq("project_id", currentProject!.id)
        .order("created_at", { ascending: false });

      if (actionsError) throw actionsError;
      setActions((actionsData as ActionTemplate[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get action for an endpoint
  const getActionForEndpoint = (endpointId: string) => {
    return actions.find((a) => a.endpoint_id === endpointId);
  };

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        ep.name.toLowerCase().includes(searchLower) ||
        ep.path.toLowerCase().includes(searchLower) ||
        ep.description?.toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  }, [endpoints, searchQuery]);

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        action.name.toLowerCase().includes(searchLower) ||
        action.description.toLowerCase().includes(searchLower);

      const matchesRisk =
        riskFilter === "all" || action.risk_level === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [actions, searchQuery, riskFilter]);

  // Open builder for endpoint
  const openBuilderForEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setEditingAction(null);
    setIsBuilderOpen(true);
  };

  // Open builder for editing
  const openBuilderForEdit = (action: ActionTemplate) => {
    setEditingAction(action);
    setSelectedEndpoint(null);
    setIsBuilderOpen(true);
  };

  // Create form data from endpoint
  const createFormDataFromEndpoint = (endpoint: Endpoint): ActionFormData => {
    // Build input schema from parameters
    const properties: Record<string, any> = {};
    const required: string[] = [];

    [...(endpoint.path_parameters || []), ...(endpoint.query_parameters || [])].forEach((param: any) => {
      properties[param.name] = {
        type: param.type || "string",
        description: param.description || undefined,
      };
      if (param.required) {
        required.push(param.name);
      }
    });

    if (endpoint.request_body_schema) {
      properties["body"] = endpoint.request_body_schema;
    }

    const inputSchema = {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };

    // Get suggestion
    const suggestion = generateActionSuggestion({
      operationId: endpoint.operation_id,
      name: endpoint.name,
      description: endpoint.description,
      method: endpoint.method as any,
      path: endpoint.path,
      tags: endpoint.tags || [],
      pathParameters: endpoint.path_parameters || [],
      queryParameters: endpoint.query_parameters || [],
      headerParameters: endpoint.header_parameters || [],
      requestBodySchema: endpoint.request_body_schema,
      responseSchemas: endpoint.response_schemas || {},
      isDeprecated: endpoint.is_deprecated,
    });

    return {
      name: suggestion.name,
      description: suggestion.description,
      riskLevel: suggestion.riskLevel,
      isIdempotent: suggestion.isIdempotent,
      inputSchema,
      outputSchema: endpoint.response_schemas?.["200"] || null,
      endpointMethod: endpoint.method,
      endpointPath: endpoint.path,
      examples: suggestion.examples,
      constraints: suggestion.constraints,
      version: 1,
      isEnabled: true,
      requiresApproval: suggestion.riskLevel === "irreversible",
      agentPolicy: "allow",
      approvalRoles: ["owner", "admin"],
      maxExecutionsPerHour: undefined,
      maxExecutionsPerDay: undefined,
      allowedEnvironments: ["development", "staging", "production"],
    };
  };

  // Create form data from action
  const createFormDataFromAction = (action: ActionTemplate): ActionFormData => {
    return {
      name: action.name,
      description: action.description,
      riskLevel: action.risk_level,
      isIdempotent: action.is_idempotent,
      inputSchema: action.input_schema || {},
      outputSchema: action.output_schema,
      endpointMethod: action.endpoint_method || "",
      endpointPath: action.endpoint_path || "",
      examples: action.examples || [],
      constraints: action.constraints || {},
      version: action.version,
      isEnabled: action.is_enabled,
      requiresApproval: action.requires_approval,
      agentPolicy: (action.agent_policy as ActionFormData["agentPolicy"]) || "allow",
      approvalRoles: action.approval_roles || ["owner", "admin"],
      maxExecutionsPerHour: action.max_executions_per_hour ?? undefined,
      maxExecutionsPerDay: action.max_executions_per_day ?? undefined,
      allowedEnvironments: action.allowed_environments || ["development", "staging", "production"],
    };
  };

  // Save action
  const handleSaveAction = async (formData: ActionFormData) => {
    setSaving(true);
    try {
      // Serialize to JSON for Supabase
      const actionData = {
        project_id: currentProject!.id,
        endpoint_id: selectedEndpoint?.id || editingAction?.endpoint_id,
        name: formData.name,
        description: formData.description,
        risk_level: formData.riskLevel as "read_only" | "safe_write" | "risky_write" | "irreversible",
        is_idempotent: formData.isIdempotent,
        is_enabled: formData.isEnabled,
        requires_approval: formData.requiresApproval,
        input_schema: JSON.parse(JSON.stringify(formData.inputSchema)),
        output_schema: formData.outputSchema ? JSON.parse(JSON.stringify(formData.outputSchema)) : null,
        endpoint_method: formData.endpointMethod,
        endpoint_path: formData.endpointPath,
        examples: JSON.parse(JSON.stringify(formData.examples)),
        constraints: JSON.parse(JSON.stringify(formData.constraints)),
        version: editingAction ? editingAction.version + 1 : 1,
        auto_generated: !editingAction,
        agent_policy: formData.agentPolicy as "allow" | "deny" | "require_confirmation" | "require_approval",
        approval_roles: formData.approvalRoles as ("owner" | "admin" | "member" | "viewer")[],
        max_executions_per_hour: formData.maxExecutionsPerHour ?? null,
        max_executions_per_day: formData.maxExecutionsPerDay ?? null,
        allowed_environments: formData.allowedEnvironments as ("development" | "staging" | "production")[],
      };

      if (editingAction) {
        // Update existing action
        const { error } = await supabase
          .from("action_templates")
          .update(actionData)
          .eq("id", editingAction.id);

        if (error) throw error;
        toast({ title: "Action updated", description: `${formData.name} has been updated to v${actionData.version}` });
      } else {
        // Create new action
        const { error } = await supabase
          .from("action_templates")
          .insert(actionData);

        if (error) throw error;
        toast({ title: "Action created", description: `${formData.name} is ready for use` });
      }

      setIsBuilderOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle action enabled
  const handleToggleEnabled = async (actionId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("action_templates")
        .update({ is_enabled: enabled })
        .eq("id", actionId);

      if (error) throw error;
      
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, is_enabled: enabled } : a))
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    }
  };

  // Delete action
  const handleDeleteAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from("action_templates")
        .delete()
        .eq("id", actionId);

      if (error) throw error;
      
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      toast({ title: "Action deleted" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: error.message,
      });
    }
  };

  // Duplicate action
  const handleDuplicateAction = async (action: ActionTemplate) => {
    try {
      const duplicateData = {
        project_id: currentProject!.id,
        endpoint_id: action.endpoint_id,
        name: `${action.name}_copy`,
        description: action.description,
        risk_level: action.risk_level,
        is_idempotent: action.is_idempotent,
        is_enabled: action.is_enabled,
        requires_approval: action.requires_approval,
        input_schema: action.input_schema,
        output_schema: action.output_schema,
        endpoint_method: action.endpoint_method,
        endpoint_path: action.endpoint_path,
        examples: action.examples,
        constraints: action.constraints,
        version: 1,
        auto_generated: false,
        agent_policy: action.agent_policy as "allow" | "deny" | "require_confirmation" | "require_approval",
        approval_roles: action.approval_roles as ("owner" | "admin" | "member" | "viewer")[],
        max_executions_per_hour: action.max_executions_per_hour,
        max_executions_per_day: action.max_executions_per_day,
        allowed_environments: action.allowed_environments as ("development" | "staging" | "production")[],
      };
      
      const { error } = await supabase.from("action_templates").insert(duplicateData);

      if (error) throw error;
      
      toast({ title: "Action duplicated" });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to duplicate",
        description: error.message,
      });
    }
  };

  // Auto-generate all actions
  const handleAutoGenerateAll = async () => {
    const endpointsWithoutActions = endpoints.filter(
      (ep) => !getActionForEndpoint(ep.id)
    );

    if (endpointsWithoutActions.length === 0) {
      toast({ title: "No endpoints to convert", description: "All endpoints already have actions" });
      return;
    }

    setSaving(true);
    try {
      const actionsToCreate = endpointsWithoutActions.map((ep) => {
        const formData = createFormDataFromEndpoint(ep);
        return {
          project_id: currentProject!.id,
          endpoint_id: ep.id,
          name: formData.name,
          description: formData.description,
          risk_level: formData.riskLevel as "read_only" | "safe_write" | "risky_write" | "irreversible",
          is_idempotent: formData.isIdempotent,
          is_enabled: true,
          requires_approval: formData.requiresApproval,
          input_schema: JSON.parse(JSON.stringify(formData.inputSchema)),
          output_schema: formData.outputSchema ? JSON.parse(JSON.stringify(formData.outputSchema)) : null,
          endpoint_method: formData.endpointMethod,
          endpoint_path: formData.endpointPath,
          examples: JSON.parse(JSON.stringify(formData.examples)),
          constraints: JSON.parse(JSON.stringify(formData.constraints)),
          version: 1,
          auto_generated: true,
          agent_policy: formData.agentPolicy as "allow" | "deny" | "require_confirmation" | "require_approval",
          approval_roles: formData.approvalRoles as ("owner" | "admin" | "member" | "viewer")[],
          max_executions_per_hour: formData.maxExecutionsPerHour ?? null,
          max_executions_per_day: formData.maxExecutionsPerDay ?? null,
          allowed_environments: formData.allowedEnvironments as ("development" | "staging" | "production")[],
        };
      });

      const { error } = await supabase
        .from("action_templates")
        .insert(actionsToCreate);

      if (error) throw error;

      toast({
        title: "Actions generated",
        description: `Created ${actionsToCreate.length} actions from endpoints`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to generate",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const endpointsWithoutActions = endpoints.filter(
    (ep) => !getActionForEndpoint(ep.id)
  );

  // Show message if no project
  return (
    <DashboardLayout title="Actions" description="Convert endpoints into agent-friendly MCP actions">
      <ProjectBanner>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search endpoints or actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {activeTab === "actions" && (
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="read_only">Read Only</SelectItem>
                  <SelectItem value="safe_write">Safe Write</SelectItem>
                  <SelectItem value="risky_write">Risky Write</SelectItem>
                  <SelectItem value="irreversible">Irreversible</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {endpointsWithoutActions.length > 0 && (
            <Button onClick={handleAutoGenerateAll} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Generate All ({endpointsWithoutActions.length})
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{endpoints.length}</p>
                  <p className="text-xs text-muted-foreground">Endpoints</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{actions.length}</p>
                  <p className="text-xs text-muted-foreground">Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Zap className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {actions.filter((a) => a.is_enabled).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Plus className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{endpointsWithoutActions.length}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="endpoints">
              Endpoints ({endpoints.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions ({actions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : hasNoLinkedTools ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <LinkIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Aucun outil lié à cet agent</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Liez des outils à cet agent depuis la page Agents pour voir leurs endpoints ici
                  </p>
                  <Button variant="outline" onClick={() => navigate("/agents")}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Gérer les outils
                  </Button>
                </CardContent>
              </Card>
            ) : filteredEndpoints.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Aucun endpoint trouvé</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Les outils liés ne contiennent pas encore d'endpoints
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Group endpoints by tool */}
                {linkedTools
                  .filter((tool) => filteredEndpoints.some((ep) => ep.sourceId === tool.id))
                  .map((tool) => {
                    const toolEndpoints = filteredEndpoints.filter((ep) => ep.sourceId === tool.id);
                    return (
                      <div key={tool.id} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">{tool.name}</h3>
                          <Badge variant="secondary" className="text-xs">{toolEndpoints.length}</Badge>
                        </div>
                        <div className="space-y-2 pl-6 border-l-2 border-border">
                          {toolEndpoints.map((endpoint) => {
                            const existingAction = getActionForEndpoint(endpoint.id);
                            const riskLevel = suggestRiskLevel({
                              operationId: endpoint.operation_id,
                              name: endpoint.name,
                              description: endpoint.description,
                              method: endpoint.method as any,
                              path: endpoint.path,
                              tags: endpoint.tags || [],
                              pathParameters: endpoint.path_parameters || [],
                              queryParameters: endpoint.query_parameters || [],
                              headerParameters: endpoint.header_parameters || [],
                              requestBodySchema: endpoint.request_body_schema,
                              responseSchemas: endpoint.response_schemas || {},
                              isDeprecated: endpoint.is_deprecated,
                            });

                            return (
                              <EndpointToActionCard
                                key={endpoint.id}
                                endpoint={{
                                  id: endpoint.id,
                                  method: endpoint.method,
                                  path: endpoint.path,
                                  name: endpoint.name,
                                  description: endpoint.description,
                                  isDeprecated: endpoint.is_deprecated,
                                  hasAction: !!existingAction,
                                }}
                                suggestedRisk={riskLevel}
                                onConvert={() => openBuilderForEndpoint(endpoint)}
                                onView={() => existingAction && openBuilderForEdit(existingAction)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredActions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No actions yet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Convert endpoints to actions using the Endpoints tab
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={{
                      id: action.id,
                      name: action.name,
                      description: action.description,
                      riskLevel: action.risk_level,
                      isEnabled: action.is_enabled,
                      isIdempotent: action.is_idempotent,
                      requiresApproval: action.requires_approval,
                      version: action.version,
                      endpointMethod: action.endpoint_method || "",
                      endpointPath: action.endpoint_path || "",
                    }}
                    onEdit={() => openBuilderForEdit(action)}
                    onDuplicate={() => handleDuplicateAction(action)}
                    onDelete={() => handleDeleteAction(action.id)}
                    onTest={() => {
                      // Navigate to simulator
                      window.location.href = "/simulator";
                    }}
                    onToggleEnabled={(enabled) => handleToggleEnabled(action.id, enabled)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Action Builder Dialog */}
        <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAction ? "Edit Action" : "Create Action"}
              </DialogTitle>
              <DialogDescription>
                {editingAction
                  ? `Editing ${editingAction.name} (v${editingAction.version})`
                  : "Configure this endpoint as an agent-friendly action"}
              </DialogDescription>
            </DialogHeader>

            {(selectedEndpoint || editingAction) && (
              <ActionBuilderForm
                initialData={
                  editingAction
                    ? createFormDataFromAction(editingAction)
                    : createFormDataFromEndpoint(selectedEndpoint!)
                }
                suggestion={
                  selectedEndpoint && !editingAction
                    ? createFormDataFromEndpoint(selectedEndpoint)
                    : undefined
                }
                onSave={handleSaveAction}
                onCancel={() => setIsBuilderOpen(false)}
                isLoading={saving}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
      </ProjectBanner>
    </DashboardLayout>
  );
}
