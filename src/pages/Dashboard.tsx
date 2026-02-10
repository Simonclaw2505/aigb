/**
 * Dashboard page for MCP Foundry
 * Overview of projects, recent activity, and quick actions
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Bot, Activity, Zap, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  // Stats cards data
  const stats = [
    { label: "Agents", value: "0", icon: Bot, color: "text-primary" },
    { label: "Outils connectés", value: "0", icon: Wrench, color: "text-success" },
    { label: "Appels API aujourd'hui", value: "0", icon: Activity, color: "text-warning" },
  ];

  return (
    <DashboardLayout title="Dashboard" description="Vue d'ensemble de vos agents">
      <div className="space-y-8">
        {/* Welcome section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Bienvenue, {firstName}
            </h2>
            <p className="text-muted-foreground mt-1">
              Orchestrez vos APIs avec des agents IA gouvernés
            </p>
          </div>
          <Button asChild>
            <Link to="/agents">
              <Plus className="mr-2 h-4 w-4" />
              Nouvel Agent
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Premiers pas</CardTitle>
              <CardDescription>
                Configurez votre premier agent en 3 étapes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Ajouter un outil</p>
                  <p className="text-xs text-muted-foreground">
                    Importez une API (OpenAPI, manuelle) dans le catalogue
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Créer un agent</p>
                  <p className="text-xs text-muted-foreground">
                    Assemblez les outils et définissez les actions autorisées
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Exporter & connecter</p>
                  <p className="text-xs text-muted-foreground">
                    Générez le lien et connectez-le à votre agent IA
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Activité récente</CardTitle>
              <CardDescription>Derniers changements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Pas encore d'activité
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Créez un agent pour commencer
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
