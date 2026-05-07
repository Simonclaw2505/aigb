/**
 * Approve / Reject dialog requiring an operator key (aig_op_…)
 * Only operators with role 'owner' or 'admin' can approve or reject.
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface OperatorInfo {
  operator_id: string;
  operator_name: string;
  role: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "approve" | "reject";
  agentId: string;
  stepNumber: number;
  actionName: string;
  description: string;
  allowedRoles?: string[];
  onConfirm: (operator: OperatorInfo) => Promise<void> | void;
}

export function ApproveWithOperatorKeyDialog({
  open,
  onOpenChange,
  mode,
  agentId,
  stepNumber,
  actionName,
  description,
  allowedRoles = ["owner", "admin"],
  onConfirm,
}: Props) {
  const [key, setKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operator, setOperator] = useState<OperatorInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKey("");
    setOperator(null);
    setError(null);
    setVerifying(false);
    setSubmitting(false);
  };

  const handleVerify = async () => {
    if (!key.trim() || !agentId) return;
    setVerifying(true);
    setError(null);
    setOperator(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-operator-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ key: key.trim(), agent_id: agentId }),
        }
      );
      const result = await res.json();

      if (!result.valid) {
        setError(result.error || "Clé invalide");
        return;
      }

      if (!allowedRoles.includes(result.role)) {
        setError(
          `Cette clé a le rôle « ${result.role} ». Rôles autorisés : ${allowedRoles.join(", ")}.`
        );
        return;
      }

      setOperator({
        operator_id: result.operator_id,
        operator_name: result.operator_name,
        role: result.role,
      });
    } catch {
      setError("Erreur de vérification de la clé");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!operator) return;
    setSubmitting(true);
    try {
      await onConfirm(operator);
      onOpenChange(false);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const isApprove = mode === "approve";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            {isApprove ? "Approuver l'action" : "Refuser l'action"}
          </DialogTitle>
          <DialogDescription>
            Étape {stepNumber} — <span className="font-medium">{actionName}</span>
            <br />
            {description}
          </DialogDescription>
        </DialogHeader>

        <Alert variant={isApprove ? "default" : "destructive"}>
          <KeyRound className="h-4 w-4" />
          <AlertDescription>
            Saisissez votre <strong>clé opérateur</strong> (<code>aig_op_…</code>) pour
            prouver votre identité. Seuls les rôles{" "}
            <strong>{allowedRoles.join(" / ")}</strong> peuvent {isApprove ? "approuver" : "refuser"}.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="operator-key">Clé opérateur</Label>
          <div className="flex gap-2">
            <Input
              id="operator-key"
              type="password"
              placeholder="aig_op_xxxxxxxxxxxx"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setOperator(null);
                setError(null);
              }}
              disabled={verifying || submitting}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleVerify}
              disabled={!key.trim() || verifying || submitting || !!operator}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Vérifier"
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {operator && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center gap-2">
                Vérifié : <strong>{operator.operator_name}</strong>
                <Badge variant="secondary">{operator.role}</Badge>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!operator || submitting}
            variant={isApprove ? "default" : "destructive"}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isApprove ? "Approbation..." : "Refus..."}
              </>
            ) : (
              <>
                {isApprove ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {isApprove ? "Confirmer l'approbation" : "Confirmer le refus"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
