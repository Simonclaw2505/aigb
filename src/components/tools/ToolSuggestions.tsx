/**
 * Smart API Suggestions - Recommends complementary tools based on what the client already uses.
 *
 * Algorithm:
 * 1. Fetch the user's connected api_sources (via agent_tools → api_sources).
 * 2. From those, derive the set of categories and slugs already in use.
 * 3. Score every tool_library entry the user hasn't connected yet:
 *    - Category affinity: tools in a related category score higher.
 *    - Co-occurrence rules: hard-coded complementary pairs boost the score.
 *    - Same-category bonus: if user already has tools in that category.
 * 4. Return the top suggestions sorted by score.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Loader2, Lightbulb, Key, Route } from "lucide-react";

interface LibraryTool {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  auth_type: string;
  endpoints: Array<{ method: string; path: string; name: string; description: string }>;
}

/**
 * Complementary relationship map.
 * Key = slug the user already connected → value = slugs that complement it.
 * This is bidirectional in scoring (we check both directions).
 */
const COMPLEMENTARY_PAIRS: Record<string, string[]> = {
  // CRM ↔ Marketing / Communication
  hubspot: ["sendgrid", "pipedrive", "salesforce", "pennylane", "quickbooks", "xero"],
  salesforce: ["sendgrid", "hubspot", "pipedrive", "quickbooks", "xero", "pennylane"],
  pipedrive: ["sendgrid", "hubspot", "salesforce", "pennylane", "quickbooks"],
  // Communication ↔ CRM / Marketing
  sendgrid: ["hubspot", "salesforce", "pipedrive"],
  // Comptabilité ↔ CRM / Productivité
  pennylane: ["hubspot", "salesforce", "pipedrive", "productive", "quickbooks", "xero"],
  quickbooks: ["hubspot", "salesforce", "pipedrive", "productive", "pennylane", "xero"],
  xero: ["hubspot", "salesforce", "pipedrive", "productive", "pennylane", "quickbooks"],
  // Productivité ↔ Comptabilité / CRM
  productive: ["pennylane", "quickbooks", "xero", "hubspot", "salesforce", "sendgrid"],
};

/**
 * Category affinity: categories that naturally complement each other.
 */
const CATEGORY_AFFINITY: Record<string, string[]> = {
  CRM: ["Communication", "Marketing", "Comptabilité"],
  Communication: ["CRM", "Marketing", "Productivité"],
  Marketing: ["CRM", "Communication"],
  Comptabilité: ["CRM", "Productivité"],
  Productivité: ["Comptabilité", "CRM", "Communication"],
};

export function ToolSuggestions() {
  const [suggestions, setSuggestions] = useState<(LibraryTool & { score: number; reason: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedCount, setConnectedCount] = useState(0);
  const { organization } = useCurrentProject();
  const navigate = useNavigate();

  const computeSuggestions = useCallback(async () => {
    if (!organization) return;
    setLoading(true);

    try {
      // 1. Get connected api_sources for this organization
      const { data: sources } = await supabase
        .from("api_sources")
        .select("id, name, description, source_type")
        .eq("organization_id", organization.id);

      const connectedSourceNames = new Set((sources || []).map((s) => s.name.toLowerCase()));
      setConnectedCount(connectedSourceNames.size);

      // Derive connected slugs (approximate match via lowercase name)
      const connectedSlugs = new Set<string>();
      const connectedCategories = new Set<string>();

      // 2. Get all library tools
      const { data: libraryTools, error } = await supabase
        .from("tool_library")
        .select("id, name, slug, description, category, auth_type, endpoints")
        .eq("is_published", true);

      if (error) throw error;

      const allTools = (libraryTools || []).map((t: any) => ({
        ...t,
        endpoints: t.endpoints || [],
      })) as LibraryTool[];

      // Match connected sources to library slugs
      for (const tool of allTools) {
        if (connectedSourceNames.has(tool.name.toLowerCase()) || connectedSourceNames.has(tool.slug.toLowerCase())) {
          connectedSlugs.add(tool.slug);
          connectedCategories.add(tool.category);
        }
      }

      // 3. Score unconnected tools
      const scored = allTools
        .filter((tool) => !connectedSlugs.has(tool.slug))
        .map((tool) => {
          let score = 0;
          const reasons: string[] = [];

          // Direct complementary match (highest weight)
          for (const slug of connectedSlugs) {
            const complements = COMPLEMENTARY_PAIRS[slug] || [];
            if (complements.includes(tool.slug)) {
              score += 30;
              reasons.push(`Complémentaire à ${slug}`);
            }
          }

          // Category affinity
          for (const cat of connectedCategories) {
            const affinities = CATEGORY_AFFINITY[cat] || [];
            if (affinities.includes(tool.category)) {
              score += 15;
              reasons.push(`Complète votre stack ${cat}`);
            }
          }

          // Same category bonus (lower, user might want diversity)
          if (connectedCategories.has(tool.category)) {
            score += 10;
            reasons.push(`Même catégorie : ${tool.category}`);
          }

          // Baseline: if user has 0 connections, boost popular/essential categories
          if (connectedSlugs.size === 0) {
            const essentialOrder = ["CRM", "Communication", "Comptabilité", "Productivité"];
            const idx = essentialOrder.indexOf(tool.category);
            if (idx !== -1) {
              score += (essentialOrder.length - idx) * 5;
              reasons.push("Essentiel pour démarrer");
            }
          }

          // Small bonus for tools with more endpoints (richer API = more value)
          if (tool.endpoints.length > 10) score += 5;

          const reason = reasons.length > 0 ? reasons[0] : "Recommandé";

          return { ...tool, score, reason };
        })
        .filter((t) => t.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      setSuggestions(scored);
    } catch (err) {
      console.error("Failed to compute suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    computeSuggestions();
  }, [computeSuggestions]);

  const authTypeLabels: Record<string, string> = {
    bearer: "Bearer Token",
    api_key: "Clé API",
    custom: "Header personnalisé",
    none: "Aucune",
  };

  if (loading) {
    return (
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Analyse de vos outils…</span>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">
          Suggestions pour vous
        </h3>
        <Badge variant="secondary" className="text-xs">
          {connectedCount > 0
            ? `Basé sur vos ${connectedCount} outil${connectedCount > 1 ? "s" : ""}`
            : "Pour bien démarrer"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((tool) => (
          <Card
            key={tool.id}
            className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/40 transition-all group"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">{tool.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-0.5">
                    {tool.description || "API disponible"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{tool.category}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-[11px] text-primary font-medium truncate">{tool.reason}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1 text-[10px] py-0">
                  <Key className="h-2.5 w-2.5" />
                  {authTypeLabels[tool.auth_type] || tool.auth_type}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-[10px] py-0">
                  <Route className="h-2.5 w-2.5" />
                  {tool.endpoints.length} endpoints
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs mt-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => navigate(`/import?library=${tool.slug}`)}
              >
                Connecter
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
