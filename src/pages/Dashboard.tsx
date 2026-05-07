/**
 * Dashboard page for AIGB
 * Overview of projects, real-time onboarding checklist, stats, and recent activity
 */
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Bot, Activity, Wrench, FileText, Clock, CheckCircle2, Circle, ArrowRight, PartyPopper, TestTube, Download, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { projects, organization } = useCurrentProject();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  const [toolsCount, setToolsCount] = useState(0);
  const [apiCallsToday, setApiCallsToday] = useState(0);
  const [apiKeysCount, setApiKeysCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (!organization) return;
    const fetchStats = async () => {
      const { data: toolsData } = await supabase
        .from("agent_tools")
        .select("api_source_id");
      if (toolsData) {
        setToolsCount(new Set(toolsData.map((r) => r.api_source_id)).size);
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count: callsCount } = await supabase
        .from("execution_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .gte("created_at", startOfDay.toISOString());
      setApiCallsToday(callsCount ?? 0);

      const { count: keysCount } = await supabase
        .from("agent_api_keys")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("is_active", true);
      setApiKeysCount(keysCount ?? 0);

      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, action, resource_type, created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentLogs((logs as AuditLogEntry[]) || []);
    };
    fetchStats();
  }, [organization]);

  const stats = [
    { label: "Agents", value: String(projects.length), icon: Bot, color: "text-primary" },
    { label: "Outils connectés", value: String(toolsCount), icon: Wrench, color: "text-success" },
    { label: "Appels API aujourd'hui", value: String(apiCallsToday), icon: Activity, color: "text-warning" },
  ];

  const onboardingSteps = [
    {
      id: "tool",
      label: "Connecter une application",
      description: "Importez une API (OpenAPI ou manuelle) dans votre catalogue",
      done: toolsCount > 0,
      href: "/tools",
      cta: "Ajouter",
    },
    {
      id: "agent",
      label: "Créer un agent",
      description: "Assemblez des outils pour votre agent IA",
      done: projects.length > 0,
      href: "/agents",
      cta: "Créer",
    },
    {
      id: "actions",
      label: "Définir les actions",
      description: "Choisissez les actions que l'agent peut effectuer",
      done: toolsCount > 0 && projects.length > 0,
      href: "/actions",
      cta: "Configurer",
    },
    {
      id: "perms",
      label: "Régler les permissions",
      description: "Autorisez, bloquez ou demandez approbation par rôle",
      done: false,
      href: "/permissions",
      cta: "Régler",
    },
  ];

  const stepsCompleted = onboardingSteps.filter((s) => s.done).length;
  const progressPct = Math.round((stepsCompleted / onboardingSteps.length) * 100);
  const allDone = stepsCompleted === onboardingSteps.length;

  const hasApiKey = apiKeysCount > 0;

  return (
    <DashboardLayout title="Dashboard" description="Vue d'ensemble de vos agents">
      <div className="space-y-8 max-w-5xl">
        {/* Status Banner */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-success/8 border border-success/15 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="text-success font-medium text-sm">Système opérationnel</span>
          <span className="text-muted-foreground ml-auto text-xs">
            Endpoint MCP actif · Agents en écoute
          </span>
        </div>

        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              Bienvenue, {firstName}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Orchestrez vos APIs avec des agents IA gouvernés
            </p>
          </div>
          <Button asChild className="rounded-lg">
            <Link to="/agents">
              <Plus className="mr-2 h-4 w-4" />
              Nouvel Agent
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color} opacity-70`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two columns: Configuration | Supervision */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Configuration ────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Configuration
              </h3>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base tracking-tight">
                      {allDone ? (
                        <span className="flex items-center gap-2">
                          <PartyPopper className="h-5 w-5 text-success" />
                          Tout est configuré !
                        </span>
                      ) : (
                        "Guide de démarrage"
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {allDone
                        ? "Votre plateforme est opérationnelle"
                        : `${stepsCompleted} / ${onboardingSteps.length} étapes complétées`}
                    </CardDescription>
                  </div>
                  {!allDone && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {progressPct}%
                    </Badge>
                  )}
                </div>
                {!allDone && <Progress value={progressPct} className="mt-3 h-1.5" />}
              </CardHeader>
              <CardContent className="space-y-2">
                {onboardingSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      step.done ? "bg-muted/30" : "bg-muted/50 hover:bg-muted/70"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                        {idx + 1}. {step.label}
                      </p>
                      {!step.done && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      )}
                    </div>
                    {!step.done && (
                      <Button asChild variant="ghost" size="sm" className="flex-shrink-0 h-7 text-xs gap-1 rounded-md">
                        <Link to={step.href}>
                          {step.cta}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* CTA — Tester */}
            <Link
              to="/simulator"
              className="block group rounded-xl border border-border/50 bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <TestTube className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold tracking-tight">Tester mon agent</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Simulez des appels avant la mise en production
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* CTA — Connecter */}
            <Link
              to={hasApiKey ? "/export" : "/settings"}
              className="block group rounded-xl border border-border/50 bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight">Connecter mon agent IA</p>
                    {hasApiKey ? (
                      <Badge variant="outline" className="text-[9px] font-mono border-success/30 text-success">
                        MCP prêt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-mono">
                        Clé requise
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasApiKey
                      ? "Récupérez votre endpoint MCP pour Claude, GPT…"
                      : "Créez d'abord une clé API dans Paramètres"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          </div>

          {/* ── Supervision ──────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Supervision
              </h3>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            {/* Activité récente */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base tracking-tight">Activité récente</CardTitle>
                    <CardDescription className="text-xs">Derniers changements</CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1 rounded-md">
                    <Link to="/audit-logs">
                      Voir tout
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">Pas encore d'activité</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Créez un agent pour commencer
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{log.resource_type}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
