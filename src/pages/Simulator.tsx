/**
 * Simulator page for MCP Foundry
 * Interactive Plan → Preview → Execute workflow with confirmation, PIN, and approval support
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  KeyRound,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useApprovalRequests } from "@/hooks/useApprovalRequests";
import { ConfirmActionDialog } from "@/components/simulator/ConfirmActionDialog";
import { ApprovalRequestPanel } from "@/components/simulator/ApprovalRequestPanel";
import { SecurityPinDialog } from "@/components/security/SecurityPinDialog";

interface Project {
  id: string;
  name: string;
  organization_id: string;
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
    requires_security_pin?: boolean;
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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<SimulatorPhase>("input");
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ExecutionResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Interactive workflow state
  const [confirmedSteps, setConfirmedSteps] = useState<Set<number>>(new Set());
  const [pinVerifiedForSession, setPinVerifiedForSession] = useState(false);
  const [securityPin, setSecurityPin] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmingStep, setConfirmingStep] = useState<PlanStep | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinActionStep, setPinActionStep] = useState<PlanStep | null>(null);

  // Approval requests hook
  const {
    createApprovalRequest,
    approveRequest,
    rejectRequest,
    getApprovalForStep,
    areAllApprovalsGranted,
    resetApprovals,
    loading: approvalsLoading,
  } = useApprovalRequests({
    organizationId: selectedProject?.organization_id || null,
    projectId: selectedProjectId || null,
  });

  // Fetch projects and user role
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;

      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("id, name, organization_id")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id);
          setSelectedProject(data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  // Fetch user role when project changes
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !selectedProjectId) return;

      try {
        const { data } = await supabase.rpc("get_project_org_role", {
          _user_id: user.id,
          _project_id: selectedProjectId,
        });
        setUserRole(data);
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      }
    };

    fetchUserRole();
  }, [user, selectedProjectId]);

  const isAdmin = userRole === "owner" || userRole === "admin";

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

  // Check if a step needs confirmation
  const stepNeedsConfirmation = (stepNumber: number): boolean => {
    const result = dryRunResult?.results.find((r) => r.step_number === stepNumber);
    return result?.permission_check?.requires_confirmation === true && !confirmedSteps.has(stepNumber);
  };

  // Check if a step needs PIN
  const stepNeedsPin = (stepNumber: number): boolean => {
    const result = dryRunResult?.results.find((r) => r.step_number === stepNumber);
    return result?.permission_check?.requires_security_pin === true && !pinVerifiedForSession;
  };

  // Check if a step needs approval
  const stepNeedsApproval = (stepNumber: number): boolean => {
    const result = dryRunResult?.results.find((r) => r.step_number === stepNumber);
    if (!result?.permission_check?.requires_approval) return false;
    const approval = getApprovalForStep(stepNumber);
    return !approval || approval.status !== "approved";
  };

  // Get steps requiring each type of action
  const getStepsNeedingConfirmation = (): number[] => {
    if (!dryRunResult) return [];
    return dryRunResult.results
      .filter((r) => r.permission_check?.requires_confirmation && !confirmedSteps.has(r.step_number))
      .map((r) => r.step_number);
  };

  const getStepsNeedingPin = (): number[] => {
    if (!dryRunResult || pinVerifiedForSession) return [];
    return dryRunResult.results
      .filter((r) => r.permission_check?.requires_security_pin)
      .map((r) => r.step_number);
  };

  const getStepsNeedingApproval = (): number[] => {
    if (!dryRunResult) return [];
    return dryRunResult.results
      .filter((r) => r.permission_check?.requires_approval && !getApprovalForStep(r.step_number)?.status?.includes("approved"))
      .map((r) => r.step_number);
  };

  // Check if we can execute
  const canExecuteNow = useCallback((): boolean => {
    if (!dryRunResult || !dryRunResult.all_steps_allowed) return false;
    
    const needsConfirmation = getStepsNeedingConfirmation();
    const needsPin = getStepsNeedingPin();
    const needsApproval = getStepsNeedingApproval();

    return needsConfirmation.length === 0 && needsPin.length === 0 && needsApproval.length === 0;
  }, [dryRunResult, confirmedSteps, pinVerifiedForSession, getApprovalForStep]);

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
    setConfirmedSteps(new Set());
    setPinVerifiedForSession(false);
    setSecurityPin(null);
    resetApprovals();

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

  // Handle confirmation dialog
  const openConfirmDialog = (step: PlanStep) => {
    setConfirmingStep(step);
    setConfirmDialogOpen(true);
  };

  const handleConfirmStep = () => {
    if (confirmingStep) {
      setConfirmedSteps((prev) => new Set([...prev, confirmingStep.step_number]));
      toast({
        title: "Step Confirmed",
        description: `${confirmingStep.action_name} has been confirmed`,
      });
    }
    setConfirmingStep(null);
  };

  // Handle PIN dialog
  const openPinDialog = (step: PlanStep) => {
    setPinActionStep(step);
    setPinDialogOpen(true);
  };

  const handlePinVerify = async (pin: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-security-pin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ pin }),
        }
      );

      const result = await response.json();

      if (result.valid) {
        setPinVerifiedForSession(true);
        setSecurityPin(pin);
        toast({
          title: "PIN Verified",
          description: "Security PIN has been verified for this session",
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Handle approval request
  const handleRequestApproval = async (step: PlanStep) => {
    if (!plan) return;
    await createApprovalRequest(
      step.step_number,
      step.action_template_id,
      step.action_name,
      plan.session_id
    );
  };

  const handleApproveStep = async (stepNumber: number) => {
    if (!user) return;
    await approveRequest(stepNumber, user.id);
  };

  const handleRejectStep = async (stepNumber: number) => {
    if (!user) return;
    await rejectRequest(stepNumber, user.id);
  };

  const handleExecute = async () => {
    if (!plan || !canExecuteNow()) {
      toast({
        title: "Cannot execute",
        description: "Please complete all required confirmations, PIN verification, and approvals",
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
            confirmed_steps: Array.from(confirmedSteps),
            security_pin: securityPin,
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
    setConfirmedSteps(new Set());
    setPinVerifiedForSession(false);
    setSecurityPin(null);
    resetApprovals();
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending_approval":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Render action buttons for a step
  const renderStepActions = (step: PlanStep, result: StepResult) => {
    const needsConfirmation = stepNeedsConfirmation(step.step_number);
    const needsPin = stepNeedsPin(step.step_number);
    const needsApproval = stepNeedsApproval(step.step_number);
    const isConfirmed = confirmedSteps.has(step.step_number);

    return (
      <div className="mt-3 space-y-3">
        {/* Confirmation section */}
        {result.permission_check.requires_confirmation && (
          <div className="flex items-center gap-2">
            {isConfirmed ? (
              <Badge className="gap-1 bg-primary/10 text-primary border-primary/30">
                <CheckCircle className="h-3 w-3" />
                Confirmed
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openConfirmDialog(step)}
                className="gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Confirm Action
              </Button>
            )}
          </div>
        )}

        {/* PIN section */}
        {result.permission_check.requires_security_pin && (
          <div className="flex items-center gap-2">
            {pinVerifiedForSession ? (
              <Badge className="gap-1 bg-primary/10 text-primary border-primary/30">
                <KeyRound className="h-3 w-3" />
                PIN Verified
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPinDialog(step)}
                className="gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Enter Security PIN
              </Button>
            )}
          </div>
        )}

        {/* Approval section */}
        {result.permission_check.requires_approval && (
          <ApprovalRequestPanel
            stepNumber={step.step_number}
            actionName={step.action_name}
            description={step.description}
            approvalRequest={getApprovalForStep(step.step_number)}
            isAdmin={isAdmin}
            onRequestApproval={() => handleRequestApproval(step)}
            onApprove={() => handleApproveStep(step.step_number)}
            onReject={() => handleRejectStep(step.step_number)}
            isLoading={approvalsLoading}
          />
        )}
      </div>
    );
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
                    onValueChange={(value) => {
                      setSelectedProjectId(value);
                      const project = projects.find((p) => p.id === value);
                      setSelectedProject(project || null);
                    }}
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
                              {result && result.permission_check.allowed && renderStepActions(step, result)}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={canExecuteNow() ? "default" : "secondary"}
                        >
                          {canExecuteNow() ? "Ready to Execute" : "Actions Required"}
                        </Badge>
                        {getStepsNeedingConfirmation().length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <UserCheck className="h-3 w-3" />
                            {getStepsNeedingConfirmation().length} confirmation(s)
                          </Badge>
                        )}
                        {getStepsNeedingPin().length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <KeyRound className="h-3 w-3" />
                            PIN required
                          </Badge>
                        )}
                        {getStepsNeedingApproval().length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {getStepsNeedingApproval().length} approval(s)
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
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Shield className="h-3 w-3" />
                            <span>
                              Permission:{" "}
                              {result.permission_check.allowed ? (
                                <span className="text-primary">Allowed</span>
                              ) : (
                                <span className="text-destructive">Denied</span>
                              )}
                            </span>
                            {result.permission_check.requires_confirmation && (
                              <Badge variant={confirmedSteps.has(result.step_number) ? "default" : "outline"} className="text-xs gap-1">
                                <UserCheck className="h-3 w-3" />
                                {confirmedSteps.has(result.step_number) ? "Confirmed" : "Needs Confirmation"}
                              </Badge>
                            )}
                            {result.permission_check.requires_security_pin && (
                              <Badge variant={pinVerifiedForSession ? "default" : "outline"} className="text-xs gap-1">
                                <KeyRound className="h-3 w-3" />
                                {pinVerifiedForSession ? "PIN Verified" : "Needs PIN"}
                              </Badge>
                            )}
                            {result.permission_check.requires_approval && (
                              <Badge variant={getApprovalForStep(result.step_number)?.status === "approved" ? "default" : "outline"} className="text-xs gap-1">
                                <Clock className="h-3 w-3" />
                                {getApprovalForStep(result.step_number)?.status === "approved" ? "Approved" : "Needs Approval"}
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
                  {canExecuteNow() ? (
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
                      <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Complete Required Actions</AlertTitle>
                        <AlertDescription>
                          {getStepsNeedingConfirmation().length > 0 && (
                            <div>• Confirm {getStepsNeedingConfirmation().length} step(s) in the plan above</div>
                          )}
                          {getStepsNeedingPin().length > 0 && (
                            <div>• Enter your security PIN</div>
                          )}
                          {getStepsNeedingApproval().length > 0 && (
                            <div>• Request and obtain {getStepsNeedingApproval().length} approval(s)</div>
                          )}
                        </AlertDescription>
                      </Alert>
                      <Button className="w-full" variant="secondary" disabled>
                        <Ban className="mr-2 h-4 w-4" />
                        Complete Actions to Execute
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
                    <CheckCircle className="h-5 w-5 text-primary" />
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

      {/* Confirmation Dialog */}
      {confirmingStep && (
        <ConfirmActionDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
          onConfirm={handleConfirmStep}
          onCancel={() => setConfirmingStep(null)}
          stepNumber={confirmingStep.step_number}
          actionName={confirmingStep.action_name}
          description={confirmingStep.description}
          estimatedImpact={confirmingStep.estimated_impact}
        />
      )}

      {/* Security PIN Dialog */}
      <SecurityPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onVerify={handlePinVerify}
        actionName={pinActionStep?.action_name}
        riskLevel="high-risk"
      />
    </DashboardLayout>
  );
}
