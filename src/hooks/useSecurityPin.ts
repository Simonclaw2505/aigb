/**
 * Security PIN Hook
 * Manages admin security PIN for high-risk action approvals
 */

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface SecurityPinState {
  hasPin: boolean;
  loading: boolean;
}

interface AdminSecurityPin {
  id: string;
  organization_id: string;
  user_id: string;
  pin_hash: string;
  created_at: string;
  updated_at: string;
}

// Helper to access new tables that may not be in generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useSecurityPin(organizationId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<SecurityPinState>({
    hasPin: false,
    loading: true,
  });

  const checkPinExists = useCallback(async () => {
    if (!organizationId || !user) {
      setState({ hasPin: false, loading: false });
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      const { data, error } = await db
        .from("admin_security_pins")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && !error.message?.includes("does not exist")) throw error;
      setState({ hasPin: !!data, loading: false });
    } catch (err) {
      console.error("Failed to check PIN:", err);
      setState({ hasPin: false, loading: false });
    }
  }, [organizationId, user]);

  useEffect(() => {
    checkPinExists();
  }, [checkPinExists]);

  const setPin = async (pin: string): Promise<boolean> => {
    if (!organizationId || !user) return false;

    try {
      // Hash the PIN using the database function
      const { data: hashResult, error: hashError } = await supabase
        .rpc("hash_security_pin", { pin });

      if (hashError) throw hashError;

      // First check if PIN exists
      const { data: existing } = await db
        .from("admin_security_pins")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing PIN
        const { error } = await db
          .from("admin_security_pins")
          .update({
            pin_hash: hashResult,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Insert new PIN
        const { error } = await db
          .from("admin_security_pins")
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            pin_hash: hashResult,
          });
        if (error) throw error;
      }

      setState(prev => ({ ...prev, hasPin: true }));
      toast({ title: "PIN configured", description: "Your security PIN has been set" });
      return true;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set PIN",
        variant: "destructive",
      });
      return false;
    }
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    if (!organizationId || !user) return false;

    try {
      // Get the stored hash
      const { data: pinData, error: fetchError } = await db
        .from("admin_security_pins")
        .select("pin_hash")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !pinData) {
        toast({
          title: "PIN not found",
          description: "Please configure your security PIN first",
          variant: "destructive",
        });
        return false;
      }

      const typedData = pinData as AdminSecurityPin;

      // Verify using the database function
      const { data: isValid, error: verifyError } = await supabase
        .rpc("verify_security_pin", { pin, stored_hash: typedData.pin_hash });

      if (verifyError) throw verifyError;

      if (!isValid) {
        toast({
          title: "Invalid PIN",
          description: "The security PIN you entered is incorrect",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to verify PIN",
        variant: "destructive",
      });
      return false;
    }
  };

  const deletePin = async (): Promise<boolean> => {
    if (!organizationId || !user) return false;

    try {
      const { error } = await db
        .from("admin_security_pins")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", user.id);

      if (error) throw error;

      setState(prev => ({ ...prev, hasPin: false }));
      toast({ title: "PIN removed", description: "Your security PIN has been deleted" });
      return true;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete PIN",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    ...state,
    setPin,
    verifyPin,
    deletePin,
    refetch: checkPinExists,
  };
}
