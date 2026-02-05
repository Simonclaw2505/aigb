/**
 * Dashboard page for MCP Foundry
 * Overview of projects, recent activity, and quick actions
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FolderOpen, Activity, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  // Stats cards data
  const stats = [
    { label: "Total Projects", value: "0", icon: FolderOpen, color: "text-primary" },
    { label: "Active Actions", value: "0", icon: Zap, color: "text-success" },
    { label: "API Calls Today", value: "0", icon: Activity, color: "text-warning" },
  ];

  return (
    <DashboardLayout title="Dashboard" description="Overview of your MCP projects">
      <div className="space-y-8">
        {/* Welcome section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Welcome back, {firstName}
            </h2>
            <p className="text-muted-foreground mt-1">
              Convert your APIs into agent-friendly MCP toolsets
            </p>
          </div>
          <Button asChild>
            <Link to="/projects">
              <Plus className="mr-2 h-4 w-4" />
              New Project
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
              <CardTitle className="text-lg">Quick Start</CardTitle>
              <CardDescription>
                Get started by creating your first MCP project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Create a project</p>
                  <p className="text-xs text-muted-foreground">
                    Set up your workspace for a new API
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Import OpenAPI spec</p>
                  <p className="text-xs text-muted-foreground">
                    Upload or paste your API specification
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Configure & export</p>
                  <p className="text-xs text-muted-foreground">
                    Set permissions and export your MCP
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest changes in your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  No recent activity yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a project to get started
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
