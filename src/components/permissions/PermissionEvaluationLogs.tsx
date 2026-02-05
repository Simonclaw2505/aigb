/**
 * Permission Evaluation Logs
 * Audit trail of permission decisions
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { usePermissionEvaluations } from "@/hooks/usePermissions";
import { formatDistanceToNow } from "date-fns";

interface PermissionEvaluationLogsProps {
  organizationId: string;
}

export function PermissionEvaluationLogs({ organizationId }: PermissionEvaluationLogsProps) {
  const { evaluations, loading } = usePermissionEvaluations(organizationId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading evaluation logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Permission Evaluation Logs</CardTitle>
            <CardDescription>Audit trail of permission decisions</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No permission evaluations recorded yet.
              <br />
              Logs will appear when actions are executed.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(evaluation.evaluated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="capitalize">{evaluation.resource_type}</span>
                        {evaluation.resource_id && (
                          <span className="text-muted-foreground text-xs block truncate max-w-[120px]">
                            {evaluation.resource_id}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{evaluation.requested_action}</TableCell>
                    <TableCell>
                      <Badge variant={evaluation.evaluation_result === "allow" ? "default" : "destructive"}>
                        {evaluation.evaluation_result === "allow" ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {evaluation.evaluation_result}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {evaluation.requires_confirmation && (
                          <Badge variant="outline" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Confirm
                          </Badge>
                        )}
                        {evaluation.requires_approval && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Approval
                          </Badge>
                        )}
                        {!evaluation.requires_confirmation && !evaluation.requires_approval && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
