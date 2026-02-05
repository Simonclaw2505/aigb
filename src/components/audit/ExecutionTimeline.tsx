import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DiffViewer } from "./DiffViewer";
import { RollbackDialog } from "./RollbackDialog";
import type { EnrichedExecutionRun } from "@/hooks/useAuditLogs";

interface ExecutionTimelineProps {
  executions: EnrichedExecutionRun[];
  onRollbackSuccess?: () => void;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; animate?: boolean }> = {
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", animate: true },
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  timeout: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted" },
};

const riskConfig: Record<string, { icon: typeof Shield; color: string; label: string }> = {
  read_only: { icon: Shield, color: "text-green-500", label: "Read Only" },
  safe_write: { icon: Shield, color: "text-blue-500", label: "Safe Write" },
  risky_write: { icon: ShieldAlert, color: "text-amber-500", label: "Risky Write" },
  irreversible: { icon: ShieldOff, color: "text-red-500", label: "Irreversible" },
};

function ExecutionCard({
  execution,
  onRollbackSuccess,
}: {
  execution: EnrichedExecutionRun;
  onRollbackSuccess?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const status = statusConfig[execution.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;
  const riskLevel = execution.action_template?.risk_level ?? "read_only";
  const risk = riskConfig[riskLevel] ?? riskConfig.read_only;
  const RiskIcon = risk.icon;

  const isRolledBack = !!execution.rolled_back_at;
  const canRollback =
    execution.status === "success" &&
    !isRolledBack &&
    !execution.is_rollback &&
    execution.action_template?.is_reversible;

  const triggeredByUser = execution.triggered_by === "user";
  const diffSummary = execution.diff_summary as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;

  return (
    <>
      <Card className={cn("transition-all", isRolledBack && "opacity-60")}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Status indicator */}
                  <div className={cn("p-2 rounded-full", status.bg)}>
                    <StatusIcon
                      className={cn("h-4 w-4", status.color, status.animate && "animate-spin")}
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {execution.action_template?.name ?? "Unknown Action"}
                      </span>
                      {execution.is_rollback && (
                        <Badge variant="outline" className="text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Rollback
                        </Badge>
                      )}
                      {isRolledBack && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                          Rolled Back
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {triggeredByUser ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        {triggeredByUser ? "User" : "Agent"}
                      </span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}</span>
                      {execution.duration_ms && (
                        <>
                          <span>•</span>
                          <span>{execution.duration_ms}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", risk.color)}
                  >
                    <RiskIcon className="h-3 w-3 mr-1" />
                    {risk.label}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t pt-4">
              {/* Input parameters */}
              {execution.input_parameters && Object.keys(execution.input_parameters).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Input Parameters</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 font-mono">
                    {JSON.stringify(execution.input_parameters, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output data */}
              {execution.output_data && Object.keys(execution.output_data).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Output Data</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 font-mono">
                    {JSON.stringify(execution.output_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Diff summary */}
              {diffSummary && (diffSummary.before || diffSummary.after) && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Changes</h4>
                  <DiffViewer
                    before={diffSummary.before ?? null}
                    after={diffSummary.after ?? null}
                  />
                </div>
              )}

              {/* Error message */}
              {execution.error_message && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-500">Error</h4>
                  <pre className="text-xs bg-red-500/10 text-red-600 p-3 rounded-md overflow-auto">
                    {execution.error_message}
                  </pre>
                </div>
              )}

              {/* Rollback button */}
              {canRollback && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRollbackOpen(true);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rollback This Action
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <RollbackDialog
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        execution={execution}
        onSuccess={() => {
          setRollbackOpen(false);
          onRollbackSuccess?.();
        }}
      />
    </>
  );
}

export function ExecutionTimeline({ executions, onRollbackSuccess }: ExecutionTimelineProps) {
  if (executions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No executions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {executions.map((execution) => (
        <ExecutionCard
          key={execution.id}
          execution={execution}
          onRollbackSuccess={onRollbackSuccess}
        />
      ))}
    </div>
  );
}
