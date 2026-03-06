/**
 * Authentication page for AI Guard
 * Handles login and signup with email/password
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp } from "@/lib/supabase-auth";
import { signInSchema, signUpSchema, evaluatePasswordStrength } from "@/lib/validators";
import { Loader2, Shield, Lock, Eye } from "lucide-react";
import aigLogo from "@/assets/aig-logo.svg";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [gdprConsent, setGdprConsent] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const privyoLoaded = useRef(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isLockedOut = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (isLockedOut) {
      toast({
        variant: "destructive",
        title: "Trop de tentatives",
        description: `Réessayez dans ${Math.ceil(((lockedUntil || 0) - Date.now()) / 1000)}s`,
      });
      return;
    }

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[String(err.path[0])] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await signIn({ email: result.data.email, password: result.data.password });
      setLoginAttempts(0);
      toast({ title: "Welcome back!", description: "You've been signed in successfully." });
      navigate("/dashboard");
    } catch (error: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        setLoginAttempts(0);
        toast({
          variant: "destructive",
          title: "Compte temporairement verrouillé",
          description: `Trop de tentatives échouées. Réessayez dans ${LOCKOUT_SECONDS}s.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Échec de connexion",
          description: "Identifiants invalides",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, loginAttempts, lockedUntil, isLockedOut, navigate, toast]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (!gdprConsent) {
      setFieldErrors({ gdpr: "Vous devez accepter la politique de confidentialité" });
      return;
    }

    const result = signUpSchema.safeParse({ email, password, fullName: fullName || undefined });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[String(err.path[0])] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await signUp({ email: result.data.email, password: result.data.password, fullName: result.data.fullName });
      toast({
        title: "Vérifiez votre e-mail",
        description: "Nous vous avons envoyé un lien de confirmation.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Échec de l'inscription",
        description: "Impossible de créer le compte. Vérifiez vos informations.",
      });
    } finally {
      setLoading(false);
    }
  }, [email, password, fullName, gdprConsent, toast]);

  const passwordStrength = password.length > 0 ? evaluatePasswordStrength(password) : null;

  // Load Privyo widget inline in signup form when tab is active
  useEffect(() => {
    if (activeTab !== "signup" || privyoLoaded.current) return;

    const timer = setTimeout(() => {
      const target = document.getElementById("privyo-consent");
      if (!target) return;

      privyoLoaded.current = true;

      const script = document.createElement("script");
      script.src = "https://fa4be116-055d-4827-8894-b21b1fe97aaf.lovableproject.com/widget.js";
      script.setAttribute("data-api-key", "pk_8a1aaabaac2049eb88fde2c2eb27e93b");
      script.setAttribute("data-mode", "inline");
      script.setAttribute("data-target", "#privyo-consent");
      script.async = true;
      target.appendChild(script);

      const checkConsent = () => {
        const text = target.textContent || "";
        const hasWidget = target.querySelector("button, form, input, iframe");
        if (!hasWidget || text.includes("enregistré") || text.includes("Consentement enregistré")) {
          setGdprConsent(true);
        }
      };

      // After script loads, check if widget rendered or not
      script.onload = () => {
        setTimeout(checkConsent, 1500);
      };

      // If script fails to load, don't block registration
      script.onerror = () => {
        setGdprConsent(true);
      };

      // Ultimate fallback: if nothing happens after 3s, unblock
      const fallbackTimer = setTimeout(() => {
        if (!gdprConsent) {
          checkConsent();
          // If still no widget after 3s, just enable
          setTimeout(() => {
            setGdprConsent(true);
          }, 500);
        }
      }, 3000);

      // Detect consent via DOM changes
      const observer = new MutationObserver(() => {
        const text = target.textContent || "";
        if (text.includes("enregistré") || text.includes("Consentement enregistré")) {
          setGdprConsent(true);
        }
      });
      observer.observe(target, { childList: true, subtree: true, characterData: true });

      // Fallback: listen for clicks
      const handleClick = () => {
        setTimeout(() => {
          const text = target.textContent || "";
          if (text.includes("enregistré") || text.includes("Consentement enregistré")) {
            setGdprConsent(true);
          }
        }, 500);
      };
      target.addEventListener("click", handleClick);

      return () => clearTimeout(fallbackTimer);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src={aigLogo} alt="AI Guard" className="h-10" />
        </div>

        <Card className="border-border/60 shadow-xl shadow-black/5">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-xl tracking-tight">Bienvenue</CardTitle>
            <CardDescription className="text-sm mt-1">
              Pilotez vos agents IA en toute confiance
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setFieldErrors({}); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-10 rounded-lg">
                <TabsTrigger value="signin" className="rounded-md text-sm">Se connecter</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-md text-sm">Créer un compte</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-xs font-medium">Adresse e-mail</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="vous@entreprise.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading || isLockedOut}
                      autoComplete="email"
                      className="h-11 rounded-lg"
                    />
                    {fieldErrors.email && (
                      <p className="text-sm text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-xs font-medium">Mot de passe</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading || isLockedOut}
                      autoComplete="current-password"
                      className="h-11 rounded-lg"
                    />
                    {fieldErrors.password && (
                      <p className="text-sm text-destructive">{fieldErrors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-lg text-sm font-medium mt-2" disabled={loading || isLockedOut}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLockedOut ? "Verrouillé temporairement" : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-xs font-medium">Nom complet</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                      maxLength={100}
                      className="h-11 rounded-lg"
                    />
                    {fieldErrors.fullName && (
                      <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-medium">Adresse e-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="vous@entreprise.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      className="h-11 rounded-lg"
                    />
                    {fieldErrors.email && (
                      <p className="text-sm text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-medium">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      className="h-11 rounded-lg"
                    />
                    {fieldErrors.password && (
                      <p className="text-sm text-destructive">{fieldErrors.password}</p>
                    )}
                    {passwordStrength && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i <= passwordStrength.score
                                  ? passwordStrength.color
                                  : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Force : {passwordStrength.label}
                        </p>
                      </div>
                    )}
                  </div>
                  <div id="privyo-consent" className="mt-2"></div>
                  {fieldErrors.gdpr && (
                    <p className="text-sm text-destructive">{fieldErrors.gdpr}</p>
                  )}
                  <Button type="submit" className="w-full h-11 rounded-lg text-sm font-medium mt-2" disabled={loading || !gdprConsent}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Trust signals */}
        <div className="mt-8 flex items-center justify-center gap-8 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-primary/60" />
            <span>Chiffrement AES-256</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-primary/60" />
            <span>Contrôle total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-primary/60" />
            <span>Accès sécurisé</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          En continuant, vous acceptez nos Conditions d'utilisation
        </p>
      </div>
    </div>
  );
}
