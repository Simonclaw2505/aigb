import { useState } from "react";
import { AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { EnrichedExecutionRun } from "@/hooks/useAuditLogs";

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  execution: EnrichedExecutionRun;
  onSuccess: () => void;
}

export function RollbackDialog({
  open,
  onOpenChange,
  execution,
  onSuccess,
}: RollbackDialogProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRollback = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("rollback-execution", {
        body: {
          execution_id: execution.id,
          reason: reason.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Rollback initiated",
        description: "The action has been successfully rolled back.",
      });

      onSuccess();
    } catch (error) {
      console.error("Rollback failed:", error);
      toast({
        title: "Rollback failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirm Rollback
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to reverse the following action:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-4">
          {/* Action details */}
          <div className="bg-muted p-3 rounded-md">
            <p className="font-medium">{execution.action_template?.name ?? "Unknown Action"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Executed on {new Date(execution.created_at).toLocaleString()}
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              This will attempt to undo the changes made by this action. Some data may not be
              fully recoverable.
            </p>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="rollback-reason">Reason (optional)</Label>
            <Textarea
              id="rollback-reason"
              placeholder="Why are you rolling back this action?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRollback();
            }}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rolling back...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback Action
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
