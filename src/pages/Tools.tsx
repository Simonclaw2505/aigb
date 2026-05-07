/**
 * Tools catalog page
 * Organization-level API tools that can be linked to agents
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ToolLibrary } from "@/components/tools/ToolLibrary";
import { ManageToolAgentsDialog } from "@/components/tools/ManageToolAgentsDialog";
import { EditToolDialog } from "@/components/tools/EditToolDialog";
import {
  Wrench,
  Plus,
  Search,
  Trash2,
  Loader2,
  Globe,
  Calendar,
  Plug,
  BookOpen,
  Bot,
  Pencil,
} from "lucide-react";

interface Tool {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  status: string;
  version: string | null;
  spec_url: string | null;
  created_at: string;
  endpoint_count: number;
  connector_count: number;
  agent_count: number;
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageAgentsTool, setManageAgentsTool] = useState<{ id: string; name: string } | null>(null);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);

  const { organization } = useCurrentProject();

  const fetchTools = useCallback(async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const { data: sources, error } = await supabase
        .from("api_sources")
        .select("id, name, description, source_type, status, version, spec_url, created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const toolsWithCounts: Tool[] = await Promise.all(
        (sources || []).map(async (s) => {
          const [{ count: epCount }, { count: connCount }, { count: agentCount }] = await Promise.all([
            supabase.from("endpoints").select("*", { count: "exact", head: true }).eq("api_source_id", s.id),
            supabase.from("api_connectors").select("*", { count: "exact", head: true }).eq("api_source_id", s.id),
            supabase.from("agent_tools").select("*", { count: "exact", head: true }).eq("api_source_id", s.id),
          ]);
          return {
            ...s,
            endpoint_count: epCount || 0,
            connector_count: connCount || 0,
            agent_count: agentCount || 0,
          };
        })
      );

      setTools(toolsWithCounts);
    } catch (err) {
      console.error("Failed to fetch tools:", err);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleDelete = async (toolId: string) => {
    setDeletingId(toolId);
    try {
      await supabase.from("agent_tools").delete().eq("api_source_id", toolId);
      
      const { data: endpointIds } = await supabase
        .from("endpoints")
        .select("id")
        .eq("api_source_id", toolId);

      if (endpointIds && endpointIds.length > 0) {
        await supabase
          .from("action_templates")
          .delete()
          .in("endpoint_id", endpointIds.map((e) => e.id));
      }

      await supabase.from("endpoints").delete().eq("api_source_id", toolId);
      await supabase.from("api_connectors").delete().eq("api_source_id", toolId);
      const { error } = await supabase.from("api_sources").delete().eq("id", toolId);
      if (error) throw error;

      toast.success("Outil supprimé");
      fetchTools();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sourceTypeLabels: Record<string, string> = {
    openapi: "OpenAPI",
    swagger: "Swagger",
    manual: "Manuel",
    graphql: "GraphQL",
    grpc: "gRPC",
  };

  if (loading) {
    return (
      <DashboardLayout title="Outils" description="Catalogue d'APIs disponibles pour vos agents">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Outils" description="Catalogue d'APIs disponibles pour vos agents">
      <Tabs defaultValue="my-tools" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-tools" className="gap-2">
            <Wrench className="h-4 w-4" />
            Mes outils
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Bibliothèque
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-tools">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un outil..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button asChild>
                <Link to="/import">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un outil
                </Link>
              </Button>
            </div>

            {/* Tools Grid */}
            {filteredTools.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Wrench className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    {searchQuery ? "Aucun outil trouvé" : "Aucun outil configuré"}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    {searchQuery
                      ? "Essayez une autre recherche"
                      : "Ajoutez votre première API pour la rendre disponible à vos agents"}
                  </p>
                  {!searchQuery && (
                    <Button asChild>
                      <Link to="/import">
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un outil
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTools.map((tool) => (
                  <Card key={tool.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <CardTitle className="text-base truncate">{tool.name}</CardTitle>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {tool.description || "Pas de description"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setEditingToolId(tool.id)}
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={deletingId === tool.id}
                          >
                            {deletingId === tool.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer {tool.name} ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cela supprimera cet outil, ses {tool.endpoint_count} endpoint(s),
                              les connecteurs et les liens avec les agents. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(tool.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{sourceTypeLabels[tool.source_type] || tool.source_type}</Badge>
                        <Badge variant="secondary">{tool.endpoint_count} endpoints</Badge>
                        {tool.connector_count > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <Plug className="h-3 w-3" />
                            Connecté
                          </Badge>
                        )}
                        <button
                          onClick={() => setManageAgentsTool({ id: tool.id, name: tool.name })}
                          className="inline-flex"
                        >
                          <Badge
                            variant={tool.agent_count > 0 ? "default" : "outline"}
                            className="gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <Bot className="h-3 w-3" />
                            {tool.agent_count} agent{tool.agent_count !== 1 ? "s" : ""}
                          </Badge>
                        </button>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-3">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(tool.created_at).toLocaleDateString()}
                        {tool.version && <span className="ml-2">• v{tool.version}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="library">
          <ToolLibrary />
        </TabsContent>
      </Tabs>

      {/* Manage agents dialog */}
      {manageAgentsTool && organization && (
        <ManageToolAgentsDialog
          open={!!manageAgentsTool}
          onOpenChange={(open) => !open && setManageAgentsTool(null)}
          toolId={manageAgentsTool.id}
          toolName={manageAgentsTool.name}
          organizationId={organization.id}
          onChanged={fetchTools}
        />
      )}
    </DashboardLayout>
  );
}
