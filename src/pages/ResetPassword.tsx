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
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase auto-handles the recovery token from the URL hash on load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session in case the event already fired
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({ variant: "destructive", title: "Échec", description: error.message });
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
              Choisissez un nouveau mot de passe pour votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {!ready ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.
              </p>
            ) : (
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
                    autoComplete="new-password"
                    className="h-11 rounded-lg"
                  />
                </div>
                <Button type="submit" className="w-full h-11 rounded-lg text-sm font-medium mt-2" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mettre à jour le mot de passe
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
