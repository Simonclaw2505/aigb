/**
 * API Import page for MCP Foundry
 * Import OpenAPI specifications via file upload, URL, or paste
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSessionState, clearSessionKeys } from "@/hooks/useSessionState";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import { EndpointsPreview } from "@/components/import/EndpointsPreview";
import { ImportErrors } from "@/components/import/ImportErrors";
import { ManualApiConfig } from "@/components/import/ManualApiConfig";
import { SlackDiscovery, type SlackDiscoveryResult } from "@/components/import/SlackDiscovery";
import { ProjectSetup } from "@/components/onboarding/ProjectSetup";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import { useApiImport } from "@/hooks/useApiImport";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  Link as LinkIcon,
  FileJson,
  Loader2,
  CheckCircle,
  Database,
  ArrowRight,
  X,
  FileUp,
  Plug,
  Trash2,
  Globe,
} from "lucide-react";

interface ApiSource {
  id: string;
  name: string;
  source_type: string;
  status: string;
  created_at: string;
  endpoint_count: number;
}

export default function Import() {
  const [searchParams] = useSearchParams();
  const librarySlug = searchParams.get("library");
  const [importMode, setImportMode] = useSessionState<"manual" | "openapi">("import_mode", "manual");
  const [libraryData, setLibraryData] = useState<any>(null);
  const [specUrl, setSpecUrl] = useSessionState("import_spec_url", "");
  const [specJson, setSpecJson] = useSessionState("import_spec_json", "");
  const [activeTab, setActiveTab] = useSessionState("import_active_tab", "upload");
  const [dragActive, setDragActive] = useState(false);
  const [apiSources, setApiSources] = useState<ApiSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    currentProject,
    organization,
    isLoading: projectLoading,
    needsOnboarding,
    createDefaultProject,
  } = useCurrentProject();

  const {
    status,
    parsedSpec,
    selectedEndpoints,
    parseContent,
    fetchFromUrl,
    parseFromFile,
    saveToDatabase,
    setSelectedEndpoints,
    reset,
  } = useApiImport({
    projectId: currentProject?.id || "",
    organizationId: organization?.id || "",
    onSuccess: () => {
      // Reset form after successful save
      clearSessionKeys("import_");
      setSpecUrl("");
      setSpecJson("");
    },
  });

  // Fetch existing API sources for current project
  const fetchApiSources = useCallback(async () => {
    if (!currentProject) return;
    setLoadingSources(true);
    try {
      const { data: sources, error } = await supabase
        .from("api_sources")
        .select("id, name, source_type, status, created_at")
        .eq("project_id", currentProject.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get endpoint counts
      const sourcesWithCounts: ApiSource[] = await Promise.all(
        (sources || []).map(async (s) => {
          const { count } = await supabase
            .from("endpoints")
            .select("*", { count: "exact", head: true })
            .eq("api_source_id", s.id);
          return { ...s, endpoint_count: count || 0 };
        })
      );

      setApiSources(sourcesWithCounts);
    } catch (err) {
      console.error("Failed to fetch API sources:", err);
    } finally {
      setLoadingSources(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchApiSources();
  }, [fetchApiSources]);

  // Fetch library tool if slug is present
  useEffect(() => {
    if (!librarySlug) return;
    setImportMode("manual");
    (async () => {
      const { data, error } = await supabase
        .from("tool_library")
        .select("*")
        .eq("slug", librarySlug)
        .eq("is_published", true)
        .single();
      if (!error && data) {
        setLibraryData(data);
      }
    })();
  }, [librarySlug]);

  // Delete an API source with cascade
  const handleDeleteApiSource = async (sourceId: string) => {
    setDeletingSourceId(sourceId);
    try {
      // 1. Delete action_templates linked to endpoints of this source
      const { data: endpointIds } = await supabase
        .from("endpoints")
        .select("id")
        .eq("api_source_id", sourceId);

      if (endpointIds && endpointIds.length > 0) {
        const ids = endpointIds.map((e) => e.id);
        await supabase
          .from("action_templates")
          .delete()
          .in("endpoint_id", ids);
      }

      // 2. Delete endpoints
      await supabase.from("endpoints").delete().eq("api_source_id", sourceId);

      // 3. Delete api_connectors
      await supabase.from("api_connectors").delete().eq("api_source_id", sourceId);

      // 4. Delete the api_source
      const { error } = await supabase.from("api_sources").delete().eq("id", sourceId);
      if (error) throw error;

      toast.success("API source supprimée");
      fetchApiSources();
    } catch (err: any) {
      console.error("Failed to delete API source:", err);
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingSourceId(null);
    }
  };

  const isLoading = status === "parsing" || status === "saving";

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".json") || file.name.endsWith(".yaml") || file.name.endsWith(".yml"))) {
        parseFromFile(file);
      }
    },
    [parseFromFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFromFile(file);
    }
  };

  const handleUrlFetch = () => {
    if (specUrl.trim()) {
      fetchFromUrl(specUrl.trim());
    }
  };

  const handlePasteParse = () => {
    if (specJson.trim()) {
      parseContent(specJson.trim());
    }
  };

  // Show loading state
  if (projectLoading) {
    return (
      <DashboardLayout title="API Import" description="Import your OpenAPI specification">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Show onboarding if user has no project
  if (needsOnboarding) {
    return (
      <DashboardLayout title="API Import" description="Import your OpenAPI specification">
        <ProjectSetup
          onCreateProject={createDefaultProject}
          hasOrganization={!!organization}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="API Import" description="Connecte tes APIs">
      <ProjectBanner>
      <div className="space-y-6">
        {/* Existing API sources */}
        {apiSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                APIs configurées
              </CardTitle>
              <CardDescription>
                APIs déjà importées pour ce projet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{source.source_type}</Badge>
                      <div>
                        <p className="font-medium text-sm">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.endpoint_count} endpoint{source.endpoint_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingSourceId === source.id}
                        >
                          {deletingSourceId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer {source.name} ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cela supprimera cette API source, ses {source.endpoint_count} endpoint(s), 
                            les connecteurs associés et les actions générées. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteApiSource(source.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={importMode === "manual" ? "default" : "outline"}
            onClick={() => setImportMode("manual")}
          >
            <Plug className="mr-2 h-4 w-4" />
            Configuration manuelle
          </Button>
          <Button
            variant={importMode === "openapi" ? "default" : "outline"}
            onClick={() => setImportMode("openapi")}
          >
            <FileJson className="mr-2 h-4 w-4" />
            Import OpenAPI
          </Button>
        </div>

        {/* Manual mode */}
        {importMode === "manual" && (
          <ManualApiConfig
            projectId={currentProject?.id || ""}
            organizationId={organization?.id || ""}
            initialData={libraryData ? {
              name: libraryData.name,
              baseUrl: libraryData.base_url,
              description: libraryData.description || "",
              authType: libraryData.auth_type,
              authHeaderName: libraryData.auth_header_name || "Authorization",
              extraHeaders: libraryData.extra_headers && Object.keys(libraryData.extra_headers).length > 0
                ? JSON.stringify(libraryData.extra_headers, null, 2) : "",
              endpoints: (libraryData.endpoints || []).map((ep: any) => ({
                id: crypto.randomUUID(),
                method: ep.method,
                path: ep.path,
                name: ep.name || `${ep.method} ${ep.path}`,
                description: ep.description || "",
              })),
            } : undefined}
            onSuccess={() => {
              fetchApiSources();
            }}
          />
        )}

        {/* OpenAPI mode */}
        {importMode === "openapi" && (
          <>
            {/* Info banner */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-4 py-4">
                <FileJson className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Formats supportés</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    OpenAPI 3.0+, Swagger 2.0 — format JSON ou YAML
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Import methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Specification</CardTitle>
                  <CardDescription>
                    Choose how to import your API specification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                      <TabsTrigger value="upload">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </TabsTrigger>
                      <TabsTrigger value="url">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        URL
                      </TabsTrigger>
                      <TabsTrigger value="paste">
                        <FileJson className="h-4 w-4 mr-2" />
                        Paste
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4">
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                          dragActive
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-primary/50"
                        }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".json,.yaml,.yml"
                          onChange={handleFileSelect}
                        />
                        <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                        <p className="font-medium text-sm mb-1">
                          {dragActive ? "Drop your file here" : "Drop your file here or click to browse"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports .json, .yaml, and .yml files up to 5MB
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="url" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="spec-url">Specification URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="spec-url"
                            type="url"
                            placeholder="https://api.example.com/openapi.json"
                            value={specUrl}
                            onChange={(e) => setSpecUrl(e.target.value)}
                            disabled={isLoading}
                          />
                          <Button onClick={handleUrlFetch} disabled={!specUrl.trim() || isLoading}>
                            {status === "parsing" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The URL should return a valid OpenAPI or Swagger document
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="paste" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="spec-json">Specification (JSON/YAML)</Label>
                        <Textarea
                          id="spec-json"
                          placeholder='{"openapi": "3.0.0", "info": {...}, "paths": {...}}'
                          value={specJson}
                          onChange={(e) => setSpecJson(e.target.value)}
                          rows={10}
                          className="font-mono text-sm"
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        onClick={handlePasteParse}
                        disabled={!specJson.trim() || isLoading}
                        className="w-full"
                      >
                        {status === "parsing" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <FileJson className="mr-2 h-4 w-4" />
                            Parse Specification
                          </>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Spec info card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Specification Info</CardTitle>
                  <CardDescription>Details about the parsed API</CardDescription>
                </CardHeader>
                <CardContent>
                  {parsedSpec ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
                          <p className="font-medium mt-1">{parsedSpec.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Version</p>
                          <p className="font-medium mt-1">{parsedSpec.version}</p>
                        </div>
                      </div>
                      {parsedSpec.description && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                            {parsedSpec.description}
                          </p>
                        </div>
                      )}
                      {parsedSpec.baseUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Base URL</p>
                          <code className="text-sm font-mono text-primary mt-1 block">
                            {parsedSpec.baseUrl}
                          </code>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{parsedSpec.endpoints.length} Endpoints</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedEndpoints.size} selected for import
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={reset}>
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileJson className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Import a specification to see details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Validation results */}
            {parsedSpec && <ImportErrors errors={parsedSpec.errors} />}

            {/* Endpoints preview */}
            {parsedSpec && parsedSpec.endpoints.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Endpoints Preview</CardTitle>
                    <CardDescription>
                      Select which endpoints to import as MCP actions
                    </CardDescription>
                  </div>
                  <Button
                    onClick={saveToDatabase}
                    disabled={selectedEndpoints.size === 0 || isLoading}
                  >
                    {status === "saving" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Import {selectedEndpoints.size} Endpoints
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <EndpointsPreview
                    endpoints={parsedSpec.endpoints}
                    selectedEndpoints={selectedEndpoints}
                    onSelectionChange={setSelectedEndpoints}
                  />
                </CardContent>
              </Card>
            )}

            {/* Success state */}
            {status === "success" && (
              <Card className="border-emerald-500/50 bg-emerald-500/5">
                <CardContent className="flex items-center gap-4 py-6">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-600">Import Complete</p>
                    <p className="text-sm text-emerald-600/80">
                      Your endpoints have been imported and are ready to be converted to MCP actions.
                    </p>
                  </div>
                  <Button variant="outline" className="ml-auto" asChild>
                    <a href="/actions">View Actions</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      </ProjectBanner>
    </DashboardLayout>
  );
}
