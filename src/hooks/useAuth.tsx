/**
 * Authentication hook for MCP Foundry
 * Provides auth state and methods throughout the application
 * OWASP A07: Session expiration handling with auto-redirect
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  organizationId: string | undefined;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // SECURITY: Handle session expiration and token refresh failures
        if (event === "TOKEN_REFRESHED" && !session) {
          toast({
            variant: "destructive",
            title: "Session expirée",
            description: "Votre session a expiré. Veuillez vous reconnecter.",
          });
          window.location.href = "/auth";
        }

        if (event === "SIGNED_OUT") {
          setOrganizationId(undefined);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  // Fetch user's organization when authenticated
  useEffect(() => {
    if (user) {
      supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          setOrganizationId(data?.organization_id ?? undefined);
        });
    } else {
      setOrganizationId(undefined);
    }
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setOrganizationId(undefined);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, organizationId, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
