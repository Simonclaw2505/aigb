/**
 * Manual API Configuration Component
 * Allows users to configure APIs without an OpenAPI spec file
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plug,
  Plus,
  Trash2,
  Play,
  Loader2,
  Globe,
  Key,
  Route,
} from "lucide-react";
import { TestHistoryPanel, type TestHistoryEntry } from "./TestHistoryPanel";

interface ManualEndpoint {
  id: string;
  method: string;
  path: string;
  name: string;
  description: string;
}


interface InitialData {
  name: string;
  baseUrl: string;
  description?: string;
  authType?: string;
  authHeaderName?: string;
  extraHeaders?: string;
  endpoints?: ManualEndpoint[];
}

interface ManualApiConfigProps {
  projectId: string;
  organizationId: string;
  onSuccess?: () => void;
  initialData?: InitialData;
}

export function ManualApiConfig({ projectId, organizationId, onSuccess, initialData }: ManualApiConfigProps) {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl || "");
  const [apiName, setApiName] = useState(initialData?.name || "");
  const [apiDescription, setApiDescription] = useState(initialData?.description || "");
  const [authType, setAuthType] = useState(initialData?.authType || "bearer");
  const [authHeaderName, setAuthHeaderName] = useState(initialData?.authHeaderName || "Authorization");
  const [authValue, setAuthValue] = useState("");
  const [extraHeaders, setExtraHeaders] = useState(initialData?.extraHeaders || "");
  const [endpoints, setEndpoints] = useState<ManualEndpoint[]>(initialData?.endpoints || []);
  const [testHistory, setTestHistory] = useState<TestHistoryEntry[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // New endpoint form
  const [newMethod, setNewMethod] = useState("GET");
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (authType === "bearer" && authValue) {
      headers[authHeaderName] = `Bearer ${authValue}`;
    } else if (authType === "api_key" && authValue) {
      headers[authHeaderName] = authValue;
    } else if (authType === "custom" && authValue) {
      headers[authHeaderName] = authValue;
    }

    if (extraHeaders.trim()) {
      try {
        const parsed = JSON.parse(extraHeaders);
        Object.assign(headers, parsed);
      } catch {
        // ignore invalid JSON
      }
    }

    return headers;
  };

  const handleTest = async (path?: string, method?: string) => {
    if (!baseUrl.trim()) {
      toast({ variant: "destructive", title: "URL requise", description: "Entre l'URL de base de l'API" });
      return;
    }

    setTesting(true);
    const start = performance.now();
    const usedMethod = method || "GET";
    const usedPath = path || "";

    try {
      const { data, error } = await supabase.functions.invoke("test-api-connection", {
        body: {
          base_url: baseUrl.trim(),
          path: usedPath,
          method: usedMethod,
          headers: buildHeaders(),
        },
      });

      const durationMs = Math.round(performance.now() - start);

      if (error) throw error;
      const result = data as { success: boolean; status?: number; statusText?: string; body?: unknown; error?: string };

      setTestHistory((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          method: usedMethod,
          path: usedPath,
          success: result.success,
          status: result.status,
          statusText: result.statusText,
          body: result.body,
          error: result.error,
          durationMs,
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : "Erreur de test";
      setTestHistory((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          method: usedMethod,
          path: usedPath,
          success: false,
          error: message,
          durationMs,
        },
        ...prev,
      ]);
    } finally {
      setTesting(false);
    }
  };

  const addEndpoint = () => {
    if (!newPath.trim()) return;

    const endpoint: ManualEndpoint = {
      id: crypto.randomUUID(),
      method: newMethod,
      path: newPath.trim(),
      name: newName.trim() || `${newMethod} ${newPath.trim()}`,
      description: newDesc.trim(),
    };

    setEndpoints((prev) => [...prev, endpoint]);
    setNewPath("");
    setNewName("");
    setNewDesc("");
  };

  const removeEndpoint = (id: string) => {
    setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
  };

  const handleSave = async () => {
    if (!apiName.trim() || !baseUrl.trim()) {
      toast({ variant: "destructive", title: "Champs requis", description: "Le nom et l'URL de base sont obligatoires." });
      return;
    }

    setSaving(true);

    try {
      // Create api_source (manual type)
      const { data: apiSource, error: sourceError } = await supabase
        .from("api_sources")
        .insert({
          organization_id: organizationId,
          project_id: projectId,
          name: apiName.trim(),
          description: apiDescription.trim() || null,
          source_type: "manual" as const,
          status: "active" as const,
          parsed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create connector
      const authConfig: Record<string, string> = { header_name: authHeaderName };
      if (authType === "bearer") authConfig.prefix = "Bearer";

      let parsedExtraHeaders = {};
      try {
        if (extraHeaders.trim()) parsedExtraHeaders = JSON.parse(extraHeaders);
      } catch { /* ignore */ }

      const { error: connError } = await supabase
        .from("api_connectors")
        .insert({
          organization_id: organizationId,
          project_id: projectId,
          api_source_id: apiSource.id,
          name: apiName.trim(),
          description: apiDescription.trim() || null,
          base_url: baseUrl.trim(),
          auth_type: authType,
          auth_config: authConfig,
          default_headers: parsedExtraHeaders,
          is_active: true,
        });

      if (connError) throw connError;

      // Create endpoints if any
      if (endpoints.length > 0) {
        const endpointRows = endpoints.map((ep) => ({
          api_source_id: apiSource.id,
          name: ep.name,
          description: ep.description || null,
          method: ep.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
          path: ep.path,
          status: "active" as const,
          is_deprecated: false,
        }));

        const { error: epError } = await supabase.from("endpoints").insert(endpointRows);
        if (epError) throw epError;
      }

      toast({
        title: "API configurée",
        description: `"${apiName}" a été ajoutée avec ${endpoints.length} endpoint(s).`,
      });

      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      toast({ variant: "destructive", title: "Erreur", description: message });
    } finally {
      setSaving(false);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    POST: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    PATCH: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Connection info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Connexion API</CardTitle>
            </div>
            <CardDescription>URL de base et informations générales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-name">Nom de l'API *</Label>
              <Input
                id="api-name"
                placeholder="ex: Productive, Notion, Slack..."
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-url">URL de base *</Label>
              <Input
                id="base-url"
                placeholder="https://api.example.com/v2"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-desc">Description</Label>
              <Textarea
                id="api-desc"
                placeholder="Description optionnelle de l'API"
                value={apiDescription}
                onChange={(e) => setApiDescription(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Authentification</CardTitle>
            </div>
            <CardDescription>Identifiants pour accéder à l'API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type d'authentification</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="api_key">Clé API</SelectItem>
                  <SelectItem value="custom">Header personnalisé</SelectItem>
                  <SelectItem value="none">Aucune</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType !== "none" && (
              <>
                <div className="space-y-2">
                  <Label>Nom du header</Label>
                  <Input
                    placeholder="Authorization"
                    value={authHeaderName}
                    onChange={(e) => setAuthHeaderName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {authType === "bearer" ? "Token" : authType === "api_key" ? "Clé API" : "Valeur"}
                  </Label>
                  <Input
                    type="password"
                    placeholder="Ton token ou clé API"
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Headers supplémentaires (JSON)</Label>
              <Textarea
                placeholder='{"X-Organization-Id": "abc123"}'
                value={extraHeaders}
                onChange={(e) => setExtraHeaders(e.target.value)}
                rows={2}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test connection */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Button onClick={() => handleTest()} disabled={!baseUrl.trim() || testing} variant="outline">
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Tester la connexion
              </>
            )}
          </Button>

        </CardContent>
      </Card>

      {/* Test history */}
      <TestHistoryPanel
        history={testHistory}
        onClear={() => setTestHistory([])}
        methodColors={methodColors}
      />
      {/* Endpoints */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Endpoints</CardTitle>
          </div>
          <CardDescription>
            Ajoute les routes de l'API que tu veux utiliser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add endpoint form */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-24">
              <Label className="text-xs">Méthode</Label>
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Chemin</Label>
              <Input
                className="h-9"
                placeholder="/tasks, /projects/{id}..."
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs">Nom (optionnel)</Label>
              <Input
                className="h-9"
                placeholder="Lister les tâches"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={addEndpoint} disabled={!newPath.trim()} className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          <Separator />

          {/* Endpoint list */}
          {endpoints.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Aucun endpoint ajouté. Tu peux aussi sauvegarder sans endpoints et les ajouter plus tard.
            </div>
          ) : (
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <Badge variant="outline" className={methodColors[ep.method] || ""}>
                    {ep.method}
                  </Badge>
                  <code className="text-sm font-mono flex-1">{ep.path}</code>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {ep.name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTest(ep.path, ep.method)}
                      disabled={testing}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeEndpoint(ep.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!apiName.trim() || !baseUrl.trim() || saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Plug className="mr-2 h-4 w-4" />
              Sauvegarder l'API
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
