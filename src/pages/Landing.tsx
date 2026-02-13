/**
 * AIGB Landing Page
 * "Make the future safe" — AI Governance for enterprises and individuals
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Lock, Eye, ChevronRight, Check, Building2, User, Plug, Bot, SlidersHorizontal, ShieldCheck, KeyRound, Gauge, History, FlaskConical, Timer, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import aigbLogo from "@/assets/aigb-logo.png";

type ProspectType = "enterprise" | "individual" | null;

export default function Landing() {
  const navigate = useNavigate();
  const [prospectType, setProspectType] = useState<ProspectType>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    jobTitle: "",
    phone: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectType) return;

    setLoading(true);
    const { error } = await supabase.from("prospects").insert({
      type: prospectType,
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      company: prospectType === "enterprise" ? form.company : null,
      job_title: prospectType === "enterprise" ? form.jobTitle : null,
      phone: form.phone || null,
      message: form.message || null,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Erreur", description: "Une erreur est survenue. Veuillez réessayer.", variant: "destructive" });
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[hsl(220,20%,4%)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <img src={aigbLogo} alt="AIGB" className="h-8" />
            <span className="text-sm font-semibold text-white/90">AI Governance Board</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
          >
            Se connecter
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,70%,50%)]/10 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <img src={aigbLogo} alt="AIGB" className="h-16 md:h-20 mx-auto mb-8 drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]" />
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Make the future{" "}
            <span className="bg-gradient-to-r from-[hsl(220,70%,55%)] to-[hsl(260,70%,65%)] bg-clip-text text-transparent">
              safe
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Gardez le contrôle sur vos agents IA. Dans un monde où l'IA est et sera omniprésente,
            AIGB garantit la sécurité des entreprises et des particuliers, de leurs données et de leurs transactions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[hsl(220,70%,50%)] hover:bg-[hsl(220,70%,45%)] text-white px-8 h-12 text-base"
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
            >
              Rejoindre la liste d'attente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 px-8 h-12 text-base"
              onClick={() => document.getElementById("video")?.scrollIntoView({ behavior: "smooth" })}
            >
              Voir la présentation
            </Button>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: "Gouvernance IA",
              desc: "Définissez des règles claires pour chaque action de vos agents. Contrôlez ce qu'ils peuvent faire, quand et comment.",
            },
            {
              icon: Lock,
              title: "Sécurité totale",
              desc: "Approbations humaines, audit complet, permissions granulaires. Chaque action est tracée et réversible.",
            },
            {
              icon: Eye,
              title: "L'humain décide",
              desc: "Les agents IA sont des outils puissants. AIGB garantit que vous gardez toujours le dernier mot.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[hsl(220,70%,50%)]/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[hsl(220,70%,55%)]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Comment ça marche</h2>
          <p className="text-white/50 text-center mb-14 max-w-2xl mx-auto">
            En 4 étapes, reprenez le contrôle total sur ce que vos agents IA peuvent faire.
          </p>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="relative p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[hsl(220,70%,50%)]/[0.06] to-transparent overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[hsl(220,70%,50%)]/[0.04] rounded-full blur-3xl" />
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,70%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(220,70%,50%)]/20">
                  <Plug className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-[hsl(220,70%,60%)] bg-[hsl(220,70%,50%)]/10 px-2 py-0.5 rounded-full">Étape 1</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3">Connectez vos outils</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">
                    Importez vos APIs métier en quelques clics. Chaque outil connecté devient disponible dans AIGB, prêt à être utilisé par vos agents de manière encadrée.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["CRM", "Paiement", "Stock", "Facturation", "Logistique", "Email"].map((tool) => (
                      <span key={tool} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-white/60">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[hsl(260,70%,50%)]/[0.06] to-transparent overflow-hidden">
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-[hsl(260,70%,55%)]/[0.04] rounded-full blur-3xl" />
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(300,60%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(260,70%,55%)]/20">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-[hsl(260,70%,65%)] bg-[hsl(260,70%,55%)]/10 px-2 py-0.5 rounded-full">Étape 2</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3">Configurez vos agents</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">
                    Créez vos agents IA par fonction et assignez-leur les outils dont ils ont besoin.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: "Support client", tools: "CRM, Email" },
                      { name: "Vente", tools: "CRM, Paiement" },
                      { name: "Comptabilité", tools: "Facturation, Paiement" },
                    ].map(({ name, tools }) => (
                      <div key={name} className="p-3 rounded-xl bg-white/[0.04] border border-white/8">
                        <div className="text-sm font-medium text-white/80 mb-1">{name}</div>
                        <div className="text-xs text-white/35">{tools}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[hsl(30,80%,50%)]/[0.06] to-transparent overflow-hidden">
              <div className="absolute top-0 left-1/2 w-40 h-40 bg-[hsl(30,80%,50%)]/[0.04] rounded-full blur-3xl" />
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(30,80%,50%)] to-[hsl(15,80%,50%)] flex items-center justify-center shadow-lg shadow-[hsl(30,80%,50%)]/20">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-[hsl(30,80%,55%)] bg-[hsl(30,80%,50%)]/10 px-2 py-0.5 rounded-full">Étape 3</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3">Limitez et sécurisez chaque action</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">
                    Permissions granulaires par agent <strong className="text-white/70">et</strong> par utilisateur.
                    Chaque action peut être autorisée, bloquée, soumise à confirmation ou à approbation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Lecture seule", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                      { label: "Écriture sûre", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
                      { label: "Écriture risquée", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
                      { label: "Irréversible", color: "bg-red-500/15 text-red-400 border-red-500/20" },
                    ].map(({ label, color }) => (
                      <span key={label} className={`text-xs px-3 py-1.5 rounded-lg border ${color}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent overflow-hidden">
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-500/[0.04] rounded-full blur-3xl" />
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Étape 4</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3">Des garde-fous à chaque niveau</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">
                    AIGB intègre des mécanismes de sécurité avancés pour que rien ne passe entre les mailles du filet.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { icon: Fingerprint, label: "Multi-signature", desc: "Plusieurs admins valident les actions critiques.", color: "text-violet-400" },
                      { icon: KeyRound, label: "Code PIN unique", desc: "Chaque admin a un code pour les opérations sensibles.", color: "text-amber-400" },
                      { icon: Gauge, label: "Quotas journaliers", desc: "Limites sur les actions risquées.", color: "text-rose-400" },
                      { icon: History, label: "Audit & rollback", desc: "Chaque action tracée et réversible.", color: "text-blue-400" },
                      { icon: FlaskConical, label: "Politique sandbox", desc: "Test obligatoire avant la production.", color: "text-emerald-400" },
                      { icon: Timer, label: "Rate limiting", desc: "Contrôle des requêtes par agent.", color: "text-cyan-400" },
                    ].map(({ icon: Icon, label, desc, color }) => (
                      <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                        <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                        <div>
                          <span className="text-sm font-medium text-white/80">{label}</span>
                          <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video */}
      <section id="video" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Découvrez AIGB en action</h2>
          <p className="text-white/50 text-center mb-10 max-w-xl mx-auto">
            Voyez comment AIGB transforme la gestion de vos agents IA en quelques minutes.
          </p>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl shadow-[hsl(220,70%,50%)]/5">
            <video
              controls
              className="w-full aspect-video"
              poster=""
            >
              <source src="/videos/aigb-presentation.mp4" type="video/mp4" />
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          </div>
        </div>
      </section>

      {/* Sign-up form */}
      <section id="signup" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Rejoignez la liste d'attente</h2>
          <p className="text-white/50 text-center mb-10">
            Soyez parmi les premiers à sécuriser vos agents IA avec AIGB.
          </p>

          {submitted ? (
            <Card className="border-white/10 bg-white/[0.03]">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Merci pour votre inscription !</h3>
                <p className="text-white/50">
                  Notre équipe vous contactera très prochainement pour vous présenter AIGB
                  et répondre à toutes vos questions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Type selector */}
              {!prospectType ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setProspectType("enterprise")}
                    className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[hsl(220,70%,55%)]/50 transition-all text-left group"
                  >
                    <Building2 className="w-8 h-8 text-[hsl(220,70%,55%)] mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-lg mb-1">Entreprise</h3>
                    <p className="text-sm text-white/50">
                      Sécurisez les agents IA de votre organisation
                    </p>
                  </button>
                  <button
                    onClick={() => setProspectType("individual")}
                    className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[hsl(220,70%,55%)]/50 transition-all text-left group"
                  >
                    <User className="w-8 h-8 text-[hsl(220,70%,55%)] mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-lg mb-1">Particulier</h3>
                    <p className="text-sm text-white/50">
                      Gardez le contrôle sur vos outils IA personnels
                    </p>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setProspectType(null)}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors mb-2"
                  >
                    ← {prospectType === "enterprise" ? "Entreprise" : "Particulier"} · Changer
                  </button>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white/70">Prénom *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        required
                        maxLength={100}
                        value={form.firstName}
                        onChange={handleChange}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        placeholder="Jean"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white/70">Nom *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        required
                        maxLength={100}
                        value={form.lastName}
                        onChange={handleChange}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      value={form.email}
                      onChange={handleChange}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="jean@exemple.com"
                    />
                  </div>

                  {prospectType === "enterprise" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-white/70">Entreprise *</Label>
                        <Input
                          id="company"
                          name="company"
                          required
                          maxLength={200}
                          value={form.company}
                          onChange={handleChange}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle" className="text-white/70">Poste</Label>
                        <Input
                          id="jobTitle"
                          name="jobTitle"
                          maxLength={200}
                          value={form.jobTitle}
                          onChange={handleChange}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          placeholder="CTO"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white/70">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={handleChange}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white/70">Message (optionnel)</Label>
                    <Textarea
                      id="message"
                      name="message"
                      maxLength={1000}
                      value={form.message}
                      onChange={handleChange}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                      placeholder="Dites-nous en plus sur votre besoin…"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[hsl(220,70%,50%)] hover:bg-[hsl(220,70%,45%)] text-white h-12 text-base"
                  >
                    {loading ? "Envoi en cours…" : "S'inscrire à la liste d'attente"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <img src={aigbLogo} alt="AIGB" className="h-5 opacity-50" />
            <span>© {new Date().getFullYear()} AIGB. Tous droits réservés.</span>
          </div>
          <span>Make the future safe.</span>
        </div>
      </footer>
    </div>
  );
}
