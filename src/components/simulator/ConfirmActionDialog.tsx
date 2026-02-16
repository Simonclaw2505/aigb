/**
 * Confirm Action Dialog with Operator Key Verification
 * When an action requires role verification, the user enters their operator key
 * to identify themselves and authorize the action.
 */

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, AlertTriangle, KeyRound, Loader2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OperatorInfo {
  operator_id: string;
  operator_name: string;
  role: string;
}

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (operatorInfo?: OperatorInfo) => void;
  onCancel: () => void;
  stepNumber: number;
  actionName: string;
  description: string;
  estimatedImpact: string;
  requiresOperatorKey?: boolean;
  agentId?: string;
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
  requiresOperatorKey = false,
  agentId,
}: ConfirmActionDialogProps) {
  const [operatorKey, setOperatorKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedOperator, setVerifiedOperator] = useState<OperatorInfo | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleVerifyKey = async () => {
    if (!operatorKey.trim() || !agentId) return;
    setVerifying(true);
    setVerifyError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-operator-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ key: operatorKey.trim(), agent_id: agentId }),
        }
      );

      const result = await response.json();

      if (result.valid) {
        setVerifiedOperator({
          operator_id: result.operator_id,
          operator_name: result.operator_name,
          role: result.role,
        });
      } else {
        setVerifyError(result.error || "Clé invalide");
      }
    } catch {
      setVerifyError("Erreur de vérification");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(verifiedOperator || undefined);
    onOpenChange(false);
    resetState();
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setOperatorKey("");
    setVerifiedOperator(null);
    setVerifyError(null);
  };

  const canConfirm = requiresOperatorKey ? !!verifiedOperator : true;

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    member: "Operator",
    viewer: "Viewer",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Confirmation requise</DialogTitle>
              <DialogDescription>
                Vérifiez et confirmez cette action avant de continuer
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Étape {stepNumber}</Badge>
              <span className="font-medium">{actionName}</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {description}
            </p>

            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Impact estimé : </span>
              {estimatedImpact}
            </div>
          </div>

          {/* Operator key verification */}
          {requiresOperatorKey && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4" />
                Clé de vérification
              </div>

              {!verifiedOperator ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Saisissez votre clé opérateur pour vous identifier
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="aigb_op_..."
                      value={operatorKey}
                      onChange={(e) => setOperatorKey(e.target.value)}
                      disabled={verifying}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyKey()}
                    />
                    <Button
                      size="sm"
                      onClick={handleVerifyKey}
                      disabled={!operatorKey.trim() || verifying}
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Vérifier"
                      )}
                    </Button>
                  </div>
                  {verifyError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {verifyError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Identifié comme : <strong>{verifiedOperator.operator_name}</strong>
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {roleLabels[verifiedOperator.role] || verifiedOperator.role}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              En confirmant, vous autorisez l'agent à exécuter cette action.
              Cette action ne peut pas être annulée automatiquement.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <XCircle className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
