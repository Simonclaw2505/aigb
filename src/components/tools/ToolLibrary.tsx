/**
 * Tool Library - Browse pre-configured API tools from the database
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ToolLibraryForm } from "./ToolLibraryForm";
import {
  Search,
  ArrowRight,
  Loader2,
  BookOpen,
  Plus,
  Key,
  Route,
  Pencil,
  Trash2,
} from "lucide-react";
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
  endpoints: Array<{ method: string; path: string; name: string; description: string }>;
  is_published: boolean;
}

export function ToolLibrary() {
  const [tools, setTools] = useState<ToolLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolLibraryEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tool_library")
        .select("*")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setTools(
        (data || []).map((t: any) => ({
          ...t,
          extra_headers: t.extra_headers || {},
          endpoints: t.endpoints || [],
        }))
      );
    } catch (err) {
      console.error("Failed to fetch tool library:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("tool_library").delete().eq("id", id);
      if (error) throw error;
      toast.success("Outil supprimé de la bibliothèque");
      fetchTools();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const categories = [...new Set(tools.map((t) => t.category))];

  const filtered = tools.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const authTypeLabels: Record<string, string> = {
    bearer: "Bearer Token",
    api_key: "Clé API",
    custom: "Header personnalisé",
    none: "Aucune",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans la bibliothèque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {/* Category filters */}
          <Button
            variant={categoryFilter === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter(null)}
          >
            Tous
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
          <Button onClick={() => { setEditingTool(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Aucun outil trouvé</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery ? "Essayez une autre recherche" : "La bibliothèque est vide"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <Card key={tool.id} className="hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base truncate">{tool.name}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {tool.description || "Pas de description"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0 ml-2">
                    {tool.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Key className="h-3 w-3" />
                    {authTypeLabels[tool.auth_type] || tool.auth_type}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Route className="h-3 w-3" />
                    {tool.endpoints.length} endpoints
                  </Badge>
                </div>

                {tool.auth_instructions && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tool.auth_instructions}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => navigate(`/import?library=${tool.slug}`)}
                  >
                    Utiliser
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setEditingTool(tool); setFormOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === tool.id}
                      >
                        {deletingId === tool.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer {tool.name} ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cela supprimera cet outil de la bibliothèque. Les outils déjà configurés par les utilisateurs ne seront pas affectés.
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <ToolLibraryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingTool={editingTool}
        onSaved={fetchTools}
      />
    </div>
  );
}
