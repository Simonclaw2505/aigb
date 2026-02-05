/**
 * Simulator page for MCP Foundry
 * Plan → Preview → Execute workflow
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  TestTube,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Zap,
  Shield,
  Ban,
  FileJson,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
}

interface PlanStep {
  step_number: number;
  description: string;
  action_template_id: string;
  action_name: string;
  inputs: Record<string, unknown>;
  depends_on: number[];
  estimated_impact: string;
}

interface ExecutionPlan {
  session_id: string;
  request: string;
  interpretation: string;
  steps: PlanStep[];
  warnings: string[];
  requires_approval: boolean;
  approval_reasons: string[];
}

interface StepResult {
  step_number: number;
  action_name: string;
  status: "success" | "failed" | "skipped" | "pending_approval";
  result?: unknown;
  error?: string;
  dry_run_preview?: {
    would_affect: string;
    changes: unknown[];
  };
  permission_check: {
    allowed: boolean;
    requires_confirmation: boolean;
    requires_approval: boolean;
    denial_reason?: string;
  };
}

interface ExecutionResult {
  session_id: string;
  mode: "dry_run" | "execute";
  all_steps_allowed: boolean;
  requires_approval: boolean;
  results: StepResult[];
  execution_blocked: boolean;
  can_execute: boolean;
}

type SimulatorPhase = "input" | "planning" | "preview" | "executing" | "complete";

export default function Simulator() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<SimulatorPhase>("input");
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ExecutionResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;

      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("id, name")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const handleGeneratePlan = async () => {
    if (!selectedProjectId || !request.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a project and enter a request",
        variant: "destructive",
      });
      return;
    }

    setPhase("planning");
    setError(null);
    setPlan(null);
    setDryRunResult(null);
    setExecuteResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            project_id: selectedProjectId,
            request: request.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to generate plan");
      }

      if (result.error) {
        setError(result.reason || result.error);
        setPhase("input");
        return;
      }

      setPlan(result);
      setExpandedSteps(new Set(result.steps.map((s: PlanStep) => s.step_number)));
      setPhase("preview");

      // Automatically run dry-run
      await runDryRun(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
      setPhase("input");
    }
  };

  const runDryRun = async (planToRun: ExecutionPlan) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            session_id: planToRun.session_id,
            project_id: selectedProjectId,
            mode: "dry_run",
            steps: planToRun.steps,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Dry run failed");
      }

      setDryRunResult(result);
    } catch (err) {
      toast({
        title: "Dry run failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleExecute = async () => {
    if (!plan || !dryRunResult?.can_execute) {
      toast({
        title: "Cannot execute",
        description: "Plan not ready or execution blocked by permissions",
        variant: "destructive",
      });
      return;
    }

    setPhase("executing");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            session_id: plan.session_id,
            project_id: selectedProjectId,
            mode: "execute",
            steps: plan.steps,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Execution failed");
      }

      setExecuteResult(result);
      setPhase("complete");

      toast({
        title: "Execution complete",
        description: `${result.results.filter((r: StepResult) => r.status === "success").length}/${result.results.length} steps succeeded`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
      setPhase("preview");
    }
  };

  const handleReset = () => {
    setPhase("input");
    setRequest("");
    setPlan(null);
    setDryRunResult(null);
    setExecuteResult(null);
    setError(null);
    setExpandedSteps(new Set());
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending_approval":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Simulator" description="Test your MCP actions in a sandbox">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Simulator" description="Plan → Preview → Execute workflow">
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <Badge variant={phase === "input" ? "default" : "secondary"} className="gap-1">
            <Sparkles className="h-3 w-3" />
            1. Request
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={phase === "planning" ? "default" : phase === "preview" || phase === "executing" || phase === "complete" ? "secondary" : "outline"} className="gap-1">
            <FileJson className="h-3 w-3" />
            2. Plan
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={phase === "preview" ? "default" : phase === "executing" || phase === "complete" ? "secondary" : "outline"} className="gap-1">
            <Eye className="h-3 w-3" />
            3. Preview
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={phase === "executing" || phase === "complete" ? "default" : "outline"} className="gap-1">
            <Zap className="h-3 w-3" />
            4. Execute
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left panel: Input & Plan */}
          <div className="space-y-6">
            {/* Request input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Natural Language Request
                </CardTitle>
                <CardDescription>
                  Describe what you want to accomplish
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                    disabled={phase !== "input"}
                  >
                    <SelectTrigger>
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
                </div>

                <div className="space-y-2">
                  <Label>Request</Label>
                  <Textarea
                    placeholder="e.g., Tag VIP customers with churn risk based on their last purchase date"
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    rows={4}
                    disabled={phase !== "input"}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {phase === "input" && (
                  <Button
                    className="w-full"
                    onClick={handleGeneratePlan}
                    disabled={!selectedProjectId || !request.trim()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Plan
                  </Button>
                )}

                {phase === "planning" && (
                  <Button className="w-full" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating plan...
                  </Button>
                )}

                {phase !== "input" && phase !== "planning" && (
                  <Button variant="outline" className="w-full" onClick={handleReset}>
                    Start New Request
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Execution Plan */}
            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-primary" />
                    Execution Plan
                  </CardTitle>
                  <CardDescription>{plan.interpretation}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warnings</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside text-sm">
                          {plan.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {plan.requires_approval && (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Approval Required</AlertTitle>
                      <AlertDescription>
                        {plan.approval_reasons.join(", ")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    {plan.steps.map((step) => {
                      const result = dryRunResult?.results.find(
                        (r) => r.step_number === step.step_number
                      );
                      const isExpanded = expandedSteps.has(step.step_number);

                      return (
                        <Collapsible
                          key={step.step_number}
                          open={isExpanded}
                          onOpenChange={() => toggleStep(step.step_number)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <Badge variant="outline">{step.step_number}</Badge>
                              <span className="font-medium flex-1">
                                {step.action_name}
                              </span>
                              {result && getStepStatusIcon(result.status)}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-8 p-3 space-y-2 border-l-2 border-muted">
                              <p className="text-sm text-muted-foreground">
                                {step.description}
                              </p>
                              <div className="text-xs">
                                <span className="font-medium">Impact: </span>
                                {step.estimated_impact}
                              </div>
                              <div className="text-xs font-mono bg-muted p-2 rounded">
                                <span className="font-medium">Inputs: </span>
                                {JSON.stringify(step.inputs, null, 2)}
                              </div>
                              {result?.permission_check && !result.permission_check.allowed && (
                                <Alert variant="destructive" className="mt-2">
                                  <Ban className="h-4 w-4" />
                                  <AlertDescription>
                                    {result.permission_check.denial_reason}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right panel: Preview & Results */}
          <div className="space-y-6">
            {/* Dry Run Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Dry Run Preview
                </CardTitle>
                <CardDescription>
                  Preview changes without applying them
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!dryRunResult ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <TestTube className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Generate a plan to see the dry run preview
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={dryRunResult.can_execute ? "default" : "destructive"}
                        >
                          {dryRunResult.can_execute ? "Ready to Execute" : "Execution Blocked"}
                        </Badge>
                        {dryRunResult.requires_approval && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Approval Required
                          </Badge>
                        )}
                      </div>

                      <Separator />

                      {/* Step results */}
                      {dryRunResult.results.map((result) => (
                        <div
                          key={result.step_number}
                          className="p-4 rounded-lg border space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{result.step_number}</Badge>
                              <span className="font-medium">{result.action_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStepStatusIcon(result.status)}
                              <span className="text-sm capitalize">{result.status}</span>
                            </div>
                          </div>

                          {result.dry_run_preview && (
                            <div className="bg-muted/50 p-3 rounded text-sm space-y-2">
                              <p className="font-medium">
                                {result.dry_run_preview.would_affect}
                              </p>
                              {result.dry_run_preview.changes.map((change, i) => (
                                <pre
                                  key={i}
                                  className="text-xs font-mono bg-background p-2 rounded overflow-x-auto"
                                >
                                  {JSON.stringify(change, null, 2)}
                                </pre>
                              ))}
                            </div>
                          )}

                          {result.error && (
                            <Alert variant="destructive">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>{result.error}</AlertDescription>
                            </Alert>
                          )}

                          {/* Permission status */}
                          <div className="flex items-center gap-2 text-xs">
                            <Shield className="h-3 w-3" />
                            <span>
                              Permission:{" "}
                              {result.permission_check.allowed ? (
                                <span className="text-green-600">Allowed</span>
                              ) : (
                                <span className="text-destructive">Denied</span>
                              )}
                            </span>
                            {result.permission_check.requires_confirmation && (
                              <Badge variant="outline" className="text-xs">
                                Needs Confirmation
                              </Badge>
                            )}
                            {result.permission_check.requires_approval && (
                              <Badge variant="outline" className="text-xs">
                                Needs Approval
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Execute button */}
            {dryRunResult && phase === "preview" && (
              <Card>
                <CardContent className="pt-6">
                  {dryRunResult.can_execute ? (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleExecute}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Execute Plan
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <Alert variant="destructive">
                        <Ban className="h-4 w-4" />
                        <AlertTitle>Execution Blocked</AlertTitle>
                        <AlertDescription>
                          {dryRunResult.requires_approval
                            ? "This plan requires approval before execution"
                            : "One or more steps failed permission checks"}
                        </AlertDescription>
                      </Alert>
                      <Button className="w-full" variant="secondary" disabled>
                        <Ban className="mr-2 h-4 w-4" />
                        Cannot Execute
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Execution in progress */}
            {phase === "executing" && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Executing plan...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Execution results */}
            {executeResult && phase === "complete" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Execution Complete
                  </CardTitle>
                  <CardDescription>
                    {executeResult.results.filter((r) => r.status === "success").length} of{" "}
                    {executeResult.results.length} steps succeeded
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {executeResult.results.map((result) => (
                        <div
                          key={result.step_number}
                          className="p-4 rounded-lg border space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{result.step_number}</Badge>
                              <span className="font-medium">{result.action_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStepStatusIcon(result.status)}
                              <span className="text-sm capitalize">{result.status}</span>
                            </div>
                          </div>

                          {result.result && (
                            <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(result.result, null, 2)}
                            </pre>
                          )}

                          {result.error && (
                            <Alert variant="destructive">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>{result.error}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
