/**
 * Approval Request Panel
 * Displays pending approval requests and allows admins to approve/reject
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  requested_by: string | null;
  approvals: unknown[];
  rejections: unknown[];
}

interface ApprovalRequestPanelProps {
  stepNumber: number;
  actionName: string;
  description: string;
  approvalRequest: ApprovalRequest | null;
  isAdmin: boolean;
  onRequestApproval: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  isLoading?: boolean;
}

export function ApprovalRequestPanel({
  stepNumber,
  actionName,
  description,
  approvalRequest,
  isAdmin,
  onRequestApproval,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalRequestPanelProps) {
  const [localLoading, setLocalLoading] = useState<"request" | "approve" | "reject" | null>(null);

  const handleRequestApproval = async () => {
    setLocalLoading("request");
    try {
      await onRequestApproval();
    } finally {
      setLocalLoading(null);
    }
  };

  const handleApprove = async () => {
    setLocalLoading("approve");
    try {
      await onApprove();
    } finally {
      setLocalLoading(null);
    }
  };

  const handleReject = async () => {
    setLocalLoading("reject");
    try {
      await onReject();
    } finally {
      setLocalLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (!approvalRequest) return null;

    switch (approvalRequest.status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 text-warning border-warning/50">
            <Clock className="h-3 w-3" />
            Pending Approval
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="gap-1 text-primary border-primary/50">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Expired
          </Badge>
        );
    }
  };

  if (!approvalRequest) {
    return (
      <div className="rounded-lg border-2 border-warning bg-warning/15 p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-warning" />
          <Badge variant="destructive">Step {stepNumber}</Badge>
          <span className="font-bold">{actionName}</span>
        </div>

        <p className="text-sm text-foreground/90">{description}</p>

        <Alert variant="destructive" className="bg-background/50">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Action bloquée tant qu'un administrateur ne l'a pas approuvée. Aucun appel API ne sera envoyé.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleRequestApproval}
          disabled={isLoading || localLoading === "request"}
          className="w-full"
          size="lg"
        >
          {localLoading === "request" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Demande en cours...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Demander l'approbation
            </>
          )}
        </Button>
      </div>
    );
  }

  // Approval request exists - show status and actions
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Step {stepNumber}</Badge>
          <span className="font-medium">{actionName}</span>
        </div>
        {getStatusBadge()}
      </div>

      <p className="text-sm text-muted-foreground">
        {description}
      </p>

      {approvalRequest.status === "pending" && (
        <>
          <div className="text-xs text-muted-foreground">
            Requested {formatDistanceToNow(new Date(approvalRequest.created_at), {
              addSuffix: true,
              locale: fr,
            })}
          </div>

          {isAdmin && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading || localLoading !== null}
                className="flex-1"
              >
                {localLoading === "reject" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </>
                )}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading || localLoading !== null}
                className="flex-1"
              >
                {localLoading === "approve" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          )}

          {!isAdmin && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Waiting for an administrator to review this request.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {approvalRequest.status === "approved" && (
        <Alert className="bg-primary/10 border-primary/30">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            This action has been approved. You can now proceed with execution.
          </AlertDescription>
        </Alert>
      )}

      {approvalRequest.status === "rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            This action has been rejected by an administrator.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
