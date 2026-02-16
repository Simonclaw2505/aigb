/**
 * Form dialog for creating/editing a tool library entry
 */

import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface EndpointEntry {
  method: string;
  path: string;
  name: string;
  description: string;
}

interface ToolLibraryEntry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_url: string;
  auth_type: string;
  auth_header_name: string | null;
  auth_instructions: string | null;
  extra_headers: Record<string, string>;
  endpoints: EndpointEntry[];
  is_published: boolean;
}

interface ToolLibraryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTool: ToolLibraryEntry | null;
  onSaved: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ToolLibraryForm({ open, onOpenChange, editingTool, onSaved }: ToolLibraryFormProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("CRM");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState("bearer");
  const [authHeaderName, setAuthHeaderName] = useState("Authorization");
  const [authInstructions, setAuthInstructions] = useState("");
  const [extraHeadersJson, setExtraHeadersJson] = useState("");
  const [endpoints, setEndpoints] = useState<EndpointEntry[]>([]);

  // New endpoint fields
  const [newMethod, setNewMethod] = useState("GET");
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (editingTool) {
      setName(editingTool.name);
      setSlug(editingTool.slug);
      setDescription(editingTool.description || "");
      setCategory(editingTool.category);
      setBaseUrl(editingTool.base_url);
      setAuthType(editingTool.auth_type);
      setAuthHeaderName(editingTool.auth_header_name || "Authorization");
      setAuthInstructions(editingTool.auth_instructions || "");
      setExtraHeadersJson(
        Object.keys(editingTool.extra_headers).length > 0
          ? JSON.stringify(editingTool.extra_headers, null, 2)
          : ""
      );
      setEndpoints(editingTool.endpoints);
    } else {
      setName("");
      setSlug("");
      setDescription("");
      setCategory("CRM");
      setBaseUrl("");
      setAuthType("bearer");
      setAuthHeaderName("Authorization");
      setAuthInstructions("");
      setExtraHeadersJson("");
      setEndpoints([]);
    }
  }, [editingTool, open]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingTool) {
      setSlug(slugify(value));
    }
  };

  const addEndpoint = () => {
    if (!newPath.trim()) return;
    setEndpoints((prev) => [
      ...prev,
      { method: newMethod, path: newPath.trim(), name: newName.trim() || `${newMethod} ${newPath.trim()}`, description: newDesc.trim() },
    ]);
    setNewPath("");
    setNewName("");
    setNewDesc("");
  };

  const removeEndpoint = (index: number) => {
    setEndpoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim() || !baseUrl.trim()) {
      toast.error("Nom, slug et URL de base sont requis");
      return;
    }

    setSaving(true);
    try {
      let parsedExtraHeaders = {};
      if (extraHeadersJson.trim()) {
        try {
          parsedExtraHeaders = JSON.parse(extraHeadersJson);
        } catch {
          toast.error("Headers supplémentaires invalides (JSON attendu)");
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        category,
        base_url: baseUrl.trim(),
        auth_type: authType,
        auth_header_name: authHeaderName.trim() || "Authorization",
        auth_instructions: authInstructions.trim() || null,
        extra_headers: parsedExtraHeaders as any,
        endpoints: endpoints as any,
        is_published: true,
      };

      if (editingTool) {
        const { error } = await supabase
          .from("tool_library")
          .update(payload)
          .eq("id", editingTool.id);
        if (error) throw error;
        toast.success("Outil mis à jour");
      } else {
        const { error } = await supabase
          .from("tool_library")
          .insert(payload);
        if (error) throw error;
        toast.success("Outil ajouté à la bibliothèque");
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTool ? "Modifier l'outil" : "Ajouter un outil"}</DialogTitle>
          <DialogDescription>
            {editingTool ? "Modifiez les informations de cet outil" : "Ajoutez un nouvel outil à la bibliothèque"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: HubSpot" />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="hubspot" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description courte de l'API" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRM">CRM</SelectItem>
                  <SelectItem value="Comptabilité">Comptabilité</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Productivité">Productivité</SelectItem>
                  <SelectItem value="Communication">Communication</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL de base *</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type d'auth</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="api_key">Clé API</SelectItem>
                  <SelectItem value="custom">Header personnalisé</SelectItem>
                  <SelectItem value="none">Aucune</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nom du header</Label>
              <Input value={authHeaderName} onChange={(e) => setAuthHeaderName(e.target.value)} placeholder="Authorization" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instructions d'authentification</Label>
            <Textarea value={authInstructions} onChange={(e) => setAuthInstructions(e.target.value)} rows={2} placeholder="Comment obtenir un token ou une clé API..." />
          </div>

          <div className="space-y-2">
            <Label>Headers supplémentaires (JSON)</Label>
            <Textarea
              value={extraHeadersJson}
              onChange={(e) => setExtraHeadersJson(e.target.value)}
              rows={2}
              className="font-mono text-sm"
              placeholder='{"Xero-tenant-id": "<tenant_id>"}'
            />
          </div>

          <Separator />

          {/* Endpoints section */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Endpoints ({endpoints.length})</Label>
            
            <div className="flex flex-wrap gap-2 items-end">
              <div className="w-24">
                <Label className="text-xs">Méthode</Label>
                <Select value={newMethod} onValueChange={setNewMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Chemin</Label>
                <Input className="h-9" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/endpoint" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Nom</Label>
                <Input className="h-9" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom" />
              </div>
              <Button size="sm" onClick={addEndpoint} disabled={!newPath.trim()} className="h-9">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {endpoints.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm">
                    <Badge variant="outline" className={`text-xs ${methodColors[ep.method] || ""}`}>
                      {ep.method}
                    </Badge>
                    <code className="font-mono text-xs flex-1 truncate">{ep.path}</code>
                    <span className="text-muted-foreground text-xs truncate max-w-[120px]">{ep.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEndpoint(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingTool ? "Mettre à jour" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
