/**
 * Security PIN Dialog
 * Modal for entering security PIN to authorize high-risk actions
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

interface SecurityPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (pin: string) => Promise<boolean>;
  actionName?: string;
  riskLevel?: string;
}

export function SecurityPinDialog({
  open,
  onOpenChange,
  onVerify,
  actionName = "this action",
  riskLevel = "high-risk",
}: SecurityPinDialogProps) {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError("PIN must be 6 digits");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const success = await onVerify(pin);
      if (success) {
        setPin("");
        onOpenChange(false);
      } else {
        setError("Invalid PIN. Please try again.");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Security PIN Required</DialogTitle>
              <DialogDescription>
                Enter your 6-digit PIN to authorize {actionName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              This is a <strong className="text-foreground">{riskLevel}</strong> action. Your security PIN is required to proceed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">Security PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPin(value);
                setError("");
              }}
              placeholder="••••••"
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={pin.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Authorize
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
