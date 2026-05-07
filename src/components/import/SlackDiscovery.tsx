/**
 * Slack token-driven endpoint discovery.
 * Step 1: user pastes Slack token (xoxb- or xoxp-)
 * Step 2: backend validates via auth.test and returns the real Slack endpoint catalog
 *         (annotated with `available` based on granted scopes when present).
 * Step 3: user selects endpoints to import — token is forwarded to ManualApiConfig.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";

export interface DiscoveredEndpoint {
  method: string;
  path: string;
  name: string;
  description: string;
  scopes?: string[];
  available?: boolean;
}

export interface SlackDiscoveryResult {
  token: string;
  team?: string;
  user?: string;
  grantedScopes: string[];
  endpoints: DiscoveredEndpoint[];
}

interface Props {
  onConfirm: (result: SlackDiscoveryResult) => void;
}

export function SlackDiscovery({ onConfirm }: Props) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [discovery, setDiscovery] = useState<{
    team?: string;
    user?: string;
    grantedScopes: string[];
    endpoints: DiscoveredEndpoint[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleDiscover = async () => {
    if (!token.trim()) {
      toast.error("Collez votre token Slack (xoxb- ou xoxp-)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-discover", {
        body: { token: token.trim() },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || "Token invalide", { description: data?.hint });
        return;
      }
      setDiscovery({
        team: data.team,
        user: data.user,
        grantedScopes: data.granted_scopes || [],
        endpoints: data.endpoints || [],
      });
      // Pré-sélectionne les endpoints disponibles
      const available = (data.endpoints || [])
        .filter((e: DiscoveredEndpoint) => e.available)
        .map((e: DiscoveredEndpoint) => `${e.method} ${e.path}`);
      setSelected(new Set(available));
      toast.success(`Connecté à ${data.team || "Slack"}`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la validation du token");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!discovery) return;
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un endpoint");
      return;
    }
    const chosen = discovery.endpoints.filter((e) =>
      selected.has(`${e.method} ${e.path}`)
    );
    onConfirm({
      token,
      team: discovery.team,
      user: discovery.user,
      grantedScopes: discovery.grantedScopes,
      endpoints: chosen,
    });
  };

  if (!discovery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Connecter Slack
          </CardTitle>
          <CardDescription>
            Collez un token Slack pour découvrir uniquement les endpoints réellement
            accessibles avec vos permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-token">Token Slack</Label>
            <Input
              id="slack-token"
              type="password"
              placeholder="xoxb-... ou xoxp-..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
            />
            <p className="text-xs text-muted-foreground">
              Créez un Slack App sur{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                api.slack.com/apps
              </a>{" "}
              puis copiez le Bot User OAuth Token (OAuth & Permissions).
            </p>
          </div>
          <Button onClick={handleDiscover} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validation...
              </>
            ) : (
              <>
                Découvrir les endpoints disponibles
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableCount = discovery.endpoints.filter((e) => e.available).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Connecté à {discovery.team || "Slack"}
            </CardTitle>
            <CardDescription>
              {discovery.user && <>Authentifié comme <strong>{discovery.user}</strong>. </>}
              {discovery.grantedScopes.length > 0
                ? `${availableCount}/${discovery.endpoints.length} endpoints accessibles selon vos scopes.`
                : `Scopes non détectables — tous les endpoints sont affichés. À vous de cocher ceux que votre token autorise.`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDiscovery(null)}>
            Changer de token
          </Button>
        </div>
        {discovery.grantedScopes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {discovery.grantedScopes.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-mono">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[420px] border rounded-md p-2">
          <div className="space-y-1">
            {discovery.endpoints.map((ep) => {
              const key = `${ep.method} ${ep.path}`;
              const checked = selected.has(key);
              const dimmed = discovery.grantedScopes.length > 0 && !ep.available;
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer ${
                    dimmed ? "opacity-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(key)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {ep.method}
                      </Badge>
                      <code className="text-sm font-mono">{ep.path}</code>
                      <span className="text-sm font-medium">{ep.name}</span>
                      {ep.available && discovery.grantedScopes.length > 0 && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ep.description}
                    </p>
                    {ep.scopes && ep.scopes.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {ep.scopes.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] font-mono text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.size} endpoint(s) sélectionné(s)
          </p>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Continuer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
