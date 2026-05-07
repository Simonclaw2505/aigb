/**
 * Edit an existing tool: rename, change description, add/remove endpoints.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, KeyRound, CheckCircle2 } from "lucide-react";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

const AUTH_TYPES = [
  { value: "bearer", label: "Bearer Token" },
  { value: "api_key", label: "API Key (header)" },
  { value: "custom_header", label: "Custom Header" },
  { value: "none", label: "Aucune auth" },
];

interface EndpointRow {
  id: string;
  method: Method;
  path: string;
  name: string;
  description: string | null;
}

interface EditToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: string;
  onChanged?: () => void;
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PATCH: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
};

export function EditToolDialog({ open, onOpenChange, toolId, onChanged }: EditToolDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [deletingEpId, setDeletingEpId] = useState<string | null>(null);

  const [newMethod, setNewMethod] = useState<Method>("GET");
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  // Connector / token state
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [hasCredential, setHasCredential] = useState(false);
  const [authType, setAuthType] = useState<string>("bearer");
  const [authHeaderName, setAuthHeaderName] = useState("Authorization");
  const [authPrefix, setAuthPrefix] = useState("Bearer");
  const [tokenValue, setTokenValue] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [projectCtx, setProjectCtx] = useState<{ id: string; org: string } | null>(null);
  const [baseUrl, setBaseUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: src } = await supabase
        .from("api_sources")
        .select("name, description, project_id")
        .eq("id", toolId)
        .single();
      if (src) {
        setName(src.name);
        setDescription(src.description || "");
        if (src.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("organization_id")
            .eq("id", src.project_id)
            .single();
          if (proj) setProjectCtx({ id: src.project_id, org: proj.organization_id });

          const { data: conn } = await supabase
            .from("api_connectors")
            .select("id, auth_type, auth_config, credential_secret_id, base_url")
            .eq("api_source_id", toolId)
            .eq("project_id", src.project_id)
            .maybeSingle();
          if (conn) {
            setConnectorId(conn.id);
            setAuthType(conn.auth_type || "bearer");
            const cfg = (conn.auth_config as Record<string, string>) || {};
            setAuthHeaderName(cfg.header_name || "Authorization");
            setAuthPrefix(cfg.prefix ?? "Bearer");
            setHasCredential(!!conn.credential_secret_id);
            setBaseUrl(conn.base_url || "");
          } else {
            setConnectorId(null);
            setHasCredential(false);
            setBaseUrl("");
          }
        }
      }
      const { data: eps } = await supabase
        .from("endpoints")
        .select("id, method, path, name, description")
        .eq("api_source_id", toolId)
        .order("path", { ascending: true });
      setEndpoints((eps as EndpointRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    if (open && toolId) load();
  }, [open, toolId, load]);

  const handleSaveInfo = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("api_sources")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", toolId);
      if (error) throw error;
      toast.success("Outil mis à jour");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleAddEndpoint = async () => {
    if (!newPath.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("endpoints")
        .insert({
          api_source_id: toolId,
          method: newMethod,
          path: newPath.trim(),
          name: newName.trim() || `${newMethod} ${newPath.trim()}`,
          description: newDesc.trim() || null,
          status: "active" as const,
          is_deprecated: false,
        })
        .select("id, method, path, name, description")
        .single();
      if (error) throw error;
      setEndpoints((prev) => [...prev, data as EndpointRow]);
      setNewPath("");
      setNewName("");
      setNewDesc("");
      toast.success("Endpoint ajouté");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveEndpoint = async (id: string) => {
    setDeletingEpId(id);
    try {
      // Remove dependent action_templates first to avoid orphans
      await supabase.from("action_templates").delete().eq("endpoint_id", id);
      const { error } = await supabase.from("endpoints").delete().eq("id", id);
      if (error) throw error;
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
      toast.success("Endpoint supprimé");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeletingEpId(null);
    }
  };

  const handleSaveToken = async () => {
    if (!projectCtx) {
      toast.error("Cet outil n'est pas rattaché à un agent — impossible de stocker un token.");
      return;
    }
    if (!tokenValue.trim() && authType !== "none") {
      toast.error("Veuillez saisir un token");
      return;
    }
    setSavingToken(true);
    try {
      let credentialSecretId: string | null = null;

      if (authType !== "none" && tokenValue.trim()) {
        const secretName = connectorId
          ? `connector_cred_${connectorId}`
          : `connector_cred_${projectCtx.id}_${Date.now()}`;
        const { data: stored, error: secErr } = await supabase.functions.invoke("secrets-manager", {
          body: {
            action: "store",
            secret_name: secretName,
            secret_value: tokenValue.trim(),
            organization_id: projectCtx.org,
            project_id: projectCtx.id,
            description: `API credential for ${name} tool`,
          },
        });
        if (secErr) throw new Error(secErr.message || "Échec stockage token");
        credentialSecretId = stored?.secret_id ?? null;
      }

      const payload = {
        organization_id: projectCtx.org,
        project_id: projectCtx.id,
        api_source_id: toolId,
        name,
        base_url: baseUrl || "https://api.example.com",
        auth_type: authType,
        auth_config: { header_name: authHeaderName, prefix: authType === "custom_header" ? "" : authPrefix },
        ...(credentialSecretId ? { credential_secret_id: credentialSecretId } : {}),
        is_active: true,
      };

      if (connectorId) {
        const { error } = await supabase.from("api_connectors").update(payload).eq("id", connectorId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("api_connectors")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setConnectorId(data.id);
      }

      setHasCredential(!!credentialSecretId || hasCredential);
      setTokenValue("");
      toast.success("Token enregistré de manière sécurisée");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingToken(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'outil</DialogTitle>
          <DialogDescription>
            Renommez l'outil, modifiez sa description, ou ajoutez/supprimez des endpoints.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={handleSaveInfo} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Enregistrer les infos
              </Button>
            </div>

            <Separator />

            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Authentification / Token</Label>
                {hasCredential && (
                  <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Token configuré
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Le token est stocké de manière chiffrée (AES-GCM) côté serveur et utilisé par le mode Live du simulateur.
              </p>

              {!projectCtx ? (
                <p className="text-xs text-amber-600">
                  ⚠️ Cet outil n'est rattaché à aucun agent — importez-le d'abord dans un agent pour pouvoir y associer un token.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type d'auth</Label>
                      <Select value={authType} onValueChange={setAuthType}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUTH_TYPES.map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Header</Label>
                      <Input className="h-9" value={authHeaderName} onChange={(e) => setAuthHeaderName(e.target.value)} />
                    </div>
                  </div>
                  {(authType === "bearer" || authType === "api_key") && (
                    <div className="space-y-1">
                      <Label className="text-xs">Préfixe (ex: Bearer)</Label>
                      <Input className="h-9" value={authPrefix} onChange={(e) => setAuthPrefix(e.target.value)} />
                    </div>
                  )}
                  {authType !== "none" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Token / API Key</Label>
                      <Input
                        type="password"
                        className="h-9"
                        placeholder={hasCredential ? "•••••••• (laisser vide pour conserver)" : "xoxb-... ou sk-..."}
                        value={tokenValue}
                        onChange={(e) => setTokenValue(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSaveToken} disabled={savingToken}>
                      {savingToken && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Enregistrer le token
                    </Button>
                  </div>
                </>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base font-medium">Endpoints ({endpoints.length})</Label>

              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-24">
                  <Label className="text-xs">Méthode</Label>
                  <Select value={newMethod} onValueChange={(v) => setNewMethod(v as Method)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["GET", "POST", "PUT", "PATCH", "DELETE"] as Method[]).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs">Chemin</Label>
                  <Input className="h-9" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/users/{id}" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-xs">Nom</Label>
                  <Input className="h-9" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Optionnel" />
                </div>
                <Button size="sm" onClick={handleAddEndpoint} disabled={!newPath.trim() || adding} className="h-9">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={1}
                placeholder="Description du nouvel endpoint (optionnel)"
                className="text-sm"
              />

              {endpoints.length > 0 ? (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {endpoints.map((ep) => (
                    <div key={ep.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                      <Badge variant="outline" className={`text-xs ${methodColors[ep.method] || ""}`}>
                        {ep.method}
                      </Badge>
                      <code className="font-mono text-xs flex-1 truncate">{ep.path}</code>
                      <span className="text-muted-foreground text-xs truncate max-w-[140px]">{ep.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveEndpoint(ep.id)}
                        disabled={deletingEpId === ep.id}
                      >
                        {deletingEpId === ep.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucun endpoint pour le moment.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
