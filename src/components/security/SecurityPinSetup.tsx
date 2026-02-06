/**
 * Security PIN Setup
 * Component for creating or updating your personal security PIN
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { useSecurityPin } from "@/hooks/useSecurityPin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SecurityPinSetupProps {
  organizationId: string;
}

export function SecurityPinSetup({ organizationId }: SecurityPinSetupProps) {
  const { hasPin, loading, setPin, deletePin } = useSecurityPin(organizationId);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSavePin = async () => {
    if (newPin.length !== 6) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setIsSaving(true);
    setError("");

    const success = await setPin(newPin);
    if (success) {
      setNewPin("");
      setConfirmPin("");
    }

    setIsSaving(false);
  };

  const handleDeletePin = async () => {
    await deletePin();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasPin ? "bg-primary/10" : "bg-muted"}`}>
              {hasPin ? (
                <ShieldCheck className="h-5 w-5 text-primary" />
              ) : (
                <ShieldX className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Security PIN</CardTitle>
              <CardDescription>
                Your personal 6-digit PIN for authorizing high-risk actions
              </CardDescription>
            </div>
          </div>
          <Badge variant={hasPin ? "default" : "secondary"}>
            {hasPin ? "Configured" : "Not Set"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="newPin">{hasPin ? "New PIN" : "PIN"}</Label>
            <div className="relative">
              <Input
                id="newPin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setNewPin(value);
                  setError("");
                }}
                placeholder="Enter 6 digits"
                className="pr-10 font-mono tracking-widest"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setConfirmPin(value);
                setError("");
              }}
              placeholder="Confirm 6 digits"
              className="font-mono tracking-widest"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSavePin}
            disabled={newPin.length !== 6 || confirmPin.length !== 6 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {hasPin ? "Update PIN" : "Set PIN"}
              </>
            )}
          </Button>

          {hasPin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove PIN
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Security PIN?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will no longer be able to authorize high-risk actions that require PIN verification.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeletePin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          This PIN is used to authorize actions marked as requiring security verification. 
          Each admin sets their own PIN - it cannot be shared or recovered.
        </p>
      </CardContent>
    </Card>
  );
}
