/**
 * Security Checklist page for MCP Foundry
 * Production-readiness dashboard with security checks and recommendations
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Shield, 
  Lock, 
  Activity, 
  TestTube2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSecurityChecklist, CheckStatus, SecurityCategory } from "@/hooks/useSecurityChecklist";

interface Project {
  id: string;
  name: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "shield": <Shield className="h-5 w-5" />,
  "lock": <Lock className="h-5 w-5" />,
  "activity": <Activity className="h-5 w-5" />,
  "test-tube": <TestTube2 className="h-5 w-5" />,
};

const statusConfig: Record<CheckStatus, { 
  icon: React.ReactNode; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  pass: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Pass",
  },
  fail: {
    icon: <XCircle className="h-5 w-5" />,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Fail",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Warning",
  },
  unknown: {
    icon: <HelpCircle className="h-5 w-5" />,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "Unknown",
  },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  return "text-destructive";
}

function getScoreIcon(score: number): React.ReactNode {
  if (score >= 80) return <ShieldCheck className="h-12 w-12 text-green-500" />;
  if (score >= 60) return <ShieldAlert className="h-12 w-12 text-amber-500" />;
  return <ShieldX className="h-12 w-12 text-destructive" />;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Production Ready";
  if (score >= 60) return "Needs Attention";
  return "Not Ready";
}

function getCategoryStats(category: SecurityCategory) {
  const pass = category.checks.filter(c => c.status === "pass").length;
  const fail = category.checks.filter(c => c.status === "fail").length;
  const warning = category.checks.filter(c => c.status === "warning").length;
  return { pass, fail, warning, total: category.checks.length };
}

export default function Security() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const { categories, loading, overallScore, refresh } = useSecurityChecklist(selectedProjectId);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [user]);

  if (loadingProjects) {
    return (
      <DashboardLayout title="Security Checklist" description="Production readiness assessment">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (projects.length === 0) {
    return (
      <DashboardLayout title="Security Checklist" description="Production readiness assessment">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create a project first to run security checks
            </p>
            <Button variant="outline" asChild>
              <Link to="/projects">Go to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const failedChecks = categories.flatMap(c => c.checks).filter(c => c.status === "fail");
  const warningChecks = categories.flatMap(c => c.checks).filter(c => c.status === "warning");

  return (
    <DashboardLayout title="Security Checklist" description="Production readiness assessment">
      <div className="space-y-6">
        {/* Header with project selector */}
        <div className="flex items-center justify-between">
          <Select
            value={selectedProjectId || undefined}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Overall Score Card */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {getScoreIcon(overallScore)}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
                          {overallScore}%
                        </span>
                        <span className="text-lg text-muted-foreground">Security Score</span>
                      </div>
                      <p className={`text-lg font-medium ${getScoreColor(overallScore)}`}>
                        {getScoreLabel(overallScore)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {categories.flatMap(c => c.checks).filter(c => c.status === "pass").length}
                      </div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-500">
                        {warningChecks.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Warnings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">
                        {failedChecks.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
                <Progress 
                  value={overallScore} 
                  className="h-2 mt-4" 
                />
              </CardContent>
            </Card>

            {/* Critical Issues */}
            {failedChecks.length > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-lg">Critical Issues</CardTitle>
                  </div>
                  <CardDescription>
                    These issues must be resolved before going to production
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {failedChecks.map((check) => (
                      <div 
                        key={check.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border border-destructive/20"
                      >
                        <div>
                          <p className="font-medium">{check.name}</p>
                          <p className="text-sm text-muted-foreground">{check.recommendation}</p>
                        </div>
                        {check.linkTo && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={check.linkTo}>
                              {check.linkLabel || "Fix"}
                              <ExternalLink className="h-3 w-3 ml-2" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {warningChecks.length > 0 && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </div>
                  <CardDescription>
                    Consider addressing these items for better security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {warningChecks.map((check) => (
                      <div 
                        key={check.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border border-amber-500/20"
                      >
                        <div>
                          <p className="font-medium">{check.name}</p>
                          <p className="text-sm text-muted-foreground">{check.recommendation}</p>
                        </div>
                        {check.linkTo && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={check.linkTo}>
                              {check.linkLabel || "Configure"}
                              <ExternalLink className="h-3 w-3 ml-2" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Checks by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Security Checks</CardTitle>
                <CardDescription>
                  Complete breakdown of all security assessments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="space-y-4">
                  {categories.map((category) => {
                    const stats = getCategoryStats(category);
                    return (
                      <AccordionItem 
                        key={category.id} 
                        value={category.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-2 rounded-lg bg-muted">
                              {categoryIcons[category.icon]}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{category.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {category.checks.length} checks
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mr-4">
                              {stats.pass > 0 && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                  {stats.pass} passed
                                </Badge>
                              )}
                              {stats.warning > 0 && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  {stats.warning} warnings
                                </Badge>
                              )}
                              {stats.fail > 0 && (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                  {stats.fail} failed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-3 pt-2">
                            {category.checks.map((check) => {
                              const config = statusConfig[check.status];
                              return (
                                <div 
                                  key={check.id}
                                  className={`flex items-start gap-4 p-4 rounded-lg ${config.bgColor}`}
                                >
                                  <div className={config.color}>
                                    {config.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{check.name}</p>
                                      <Badge variant="outline" className={`${config.color} text-xs`}>
                                        {config.label}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {check.description}
                                    </p>
                                    {check.details && (
                                      <p className="text-sm mt-2">
                                        <span className="font-medium">Status:</span> {check.details}
                                      </p>
                                    )}
                                    {check.recommendation && check.status !== "pass" && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        <span className="font-medium">Recommendation:</span> {check.recommendation}
                                      </p>
                                    )}
                                  </div>
                                  {check.linkTo && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <Link to={check.linkTo}>
                                        {check.linkLabel || "View"}
                                        <ExternalLink className="h-3 w-3 ml-2" />
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
