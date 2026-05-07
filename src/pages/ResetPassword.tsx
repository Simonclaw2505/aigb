/**
 * Reset Password page
 * Accessible via the link emailed by Supabase after a password reset request.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import aigLogo from "@/assets/aig-logo.svg";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const initializeRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const flowType = hashParams.get("type");
      const code = searchParams.get("code");

      try {
        if (flowType === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          if (active) {
            setRecoveryReady(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (active) {
            setRecoveryReady(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (active) {
          setRecoveryReady(Boolean(session));
        }
      } catch {
        if (active) {
          setRecoveryReady(false);
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setRecoveryReady(Boolean(session));
        setInitializing(false);
      }
    });

    void initializeRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryReady) {
      toast({
        variant: "destructive",
        title: "Lien invalide ou expiré",
        description: "Demandez un nouveau lien depuis la page de connexion.",
      });
      return;
    }

    if (password.length < 8) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "8 caractères minimum." });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Les mots de passe ne correspondent pas" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Lien invalide ou expiré",
        description: "Demandez un nouveau lien depuis la page de connexion.",
      });
      return;
    }
    toast({ title: "Mot de passe mis à jour", description: "Vous pouvez maintenant vous connecter." });
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src={aigLogo} alt="AI Guard" className="h-10" />
        </div>
        <Card className="border-border/60 shadow-xl shadow-black/5">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-xl tracking-tight">Nouveau mot de passe</CardTitle>
            <CardDescription className="text-sm mt-1">
              {initializing
                ? "Validation du lien en cours..."
                : recoveryReady
                  ? "Choisissez un nouveau mot de passe pour votre compte"
                  : "Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={initializing || !recoveryReady || loading}
                  autoComplete="new-password"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={initializing || !recoveryReady || loading}
                  autoComplete="new-password"
                  className="h-11 rounded-lg"
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-lg text-sm font-medium mt-2" disabled={loading || initializing || !recoveryReady}>
                {(loading || initializing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mettre à jour le mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
