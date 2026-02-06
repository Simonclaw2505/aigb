/**
 * Confirm Action Dialog
 * Simple confirmation dialog for actions that require user confirmation before execution
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  stepNumber: number;
  actionName: string;
  description: string;
  estimatedImpact: string;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  stepNumber,
  actionName,
  description,
  estimatedImpact,
}: ConfirmActionDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Confirmation Required</DialogTitle>
              <DialogDescription>
                Review and confirm this action before proceeding
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Step {stepNumber}</Badge>
              <span className="font-medium">{actionName}</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {description}
            </p>

            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Expected Impact: </span>
              {estimatedImpact}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              By confirming, you authorize the agent to execute this action. 
              This action cannot be automatically undone.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirm Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
