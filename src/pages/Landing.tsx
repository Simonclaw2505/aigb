/**
 * AI Guard Landing Page
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
import aigLogo from "@/assets/aig-logo.svg";

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
    <div className="min-h-screen bg-[hsl(25,18%,6%)] text-[hsl(30,10%,92%)]">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[hsl(25,18%,6%)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <img src={aigLogo} alt="AI Guard" className="h-8" />
            <span className="text-sm font-semibold text-white/80 tracking-tight">AI Guard</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] rounded-lg"
            onClick={() => navigate("/auth")}
          >
            Se connecter
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        {/* Warm gradient orb */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[hsl(24,80%,50%)]/[0.08] rounded-full blur-[120px]" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-[hsl(38,85%,55%)]/[0.05] rounded-full blur-[100px]" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(24,80%,55%)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(24,80%,55%)]" />
            </span>
            <span className="text-xs font-medium text-white/50">Plateforme en accès anticipé</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-7">
            Pilotez vos agents IA{" "}
            <span className="bg-gradient-to-r from-[hsl(24,80%,55%)] via-[hsl(38,85%,58%)] to-[hsl(24,80%,55%)] bg-clip-text text-transparent">
              en confiance
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            Décidez précisément ce que vos agents IA peuvent faire, accéder et décider.
            AI Guard met la gouvernance de l'IA à portée de toute entreprise — sans expertise technique.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[hsl(24,80%,50%)] hover:bg-[hsl(24,80%,45%)] text-white px-8 h-12 text-base rounded-xl shadow-lg shadow-[hsl(24,80%,50%)]/20 transition-all hover:shadow-xl hover:shadow-[hsl(24,80%,50%)]/25"
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
            >
              Rejoindre la liste d'attente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
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
              desc: "Les agents IA sont des outils puissants. AI Guard garantit que vous gardez toujours le dernier mot.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-11 h-11 rounded-xl bg-[hsl(24,80%,50%)]/10 flex items-center justify-center mb-5 group-hover:bg-[hsl(24,80%,50%)]/15 transition-colors">
                <Icon className="w-5 h-5 text-[hsl(24,80%,55%)]" />
              </div>
              <h3 className="text-lg font-semibold mb-2.5 tracking-tight">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">Comment ça marche</h2>
          <p className="text-white/40 text-center mb-16 max-w-2xl mx-auto">
            En 5 étapes, reprenez le contrôle total sur ce que vos agents IA peuvent faire.
          </p>

          <div className="space-y-5">
            {/* Step 1 */}
            <div className="relative p-7 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[hsl(24,80%,50%)]/[0.04] to-transparent overflow-hidden group hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(24,80%,50%)] to-[hsl(38,85%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(24,80%,50%)]/15">
                  <Plug className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-mono text-[hsl(24,80%,60%)] bg-[hsl(24,80%,50%)]/10 px-2.5 py-0.5 rounded-full">Étape 1</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">Connectez vos outils</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    Importez vos APIs métier en quelques clics. Chaque outil connecté devient disponible dans AIGB, prêt à être utilisé par vos agents de manière encadrée.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["CRM", "Paiement", "Stock", "Facturation", "Logistique", "Email"].map((tool) => (
                      <span key={tool} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-7 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[hsl(280,50%,45%)]/[0.04] to-transparent overflow-hidden hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(280,50%,45%)] to-[hsl(320,45%,50%)] flex items-center justify-center shadow-lg shadow-[hsl(280,50%,45%)]/15">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-mono text-[hsl(280,50%,60%)] bg-[hsl(280,50%,45%)]/10 px-2.5 py-0.5 rounded-full">Étape 2</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">Configurez vos agents</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    Créez vos agents IA par fonction et assignez-leur les outils dont ils ont besoin.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: "Support client", tools: "CRM, Email" },
                      { name: "Vente", tools: "CRM, Paiement" },
                      { name: "Comptabilité", tools: "Facturation, Paiement" },
                    ].map(({ name, tools }) => (
                      <div key={name} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-sm font-medium text-white/70 mb-1">{name}</div>
                        <div className="text-xs text-white/30">{tools}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-7 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[hsl(38,85%,50%)]/[0.04] to-transparent overflow-hidden hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(38,85%,50%)] to-[hsl(24,80%,48%)] flex items-center justify-center shadow-lg shadow-[hsl(38,85%,50%)]/15">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-mono text-[hsl(38,85%,58%)] bg-[hsl(38,85%,50%)]/10 px-2.5 py-0.5 rounded-full">Étape 3</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">Limitez et sécurisez chaque action</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    Permissions granulaires par agent <strong className="text-white/60">et</strong> par utilisateur.
                    Chaque action peut être autorisée, bloquée, soumise à confirmation ou à approbation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Lecture seule", color: "bg-[hsl(152,60%,42%)]/12 text-[hsl(152,60%,52%)] border-[hsl(152,60%,42%)]/15" },
                      { label: "Écriture sûre", color: "bg-[hsl(210,70%,50%)]/12 text-[hsl(210,70%,60%)] border-[hsl(210,70%,50%)]/15" },
                      { label: "Écriture risquée", color: "bg-[hsl(38,85%,50%)]/12 text-[hsl(38,85%,58%)] border-[hsl(38,85%,50%)]/15" },
                      { label: "Irréversible", color: "bg-[hsl(0,72%,51%)]/12 text-[hsl(0,72%,60%)] border-[hsl(0,72%,51%)]/15" },
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
            <div className="relative p-7 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[hsl(152,60%,42%)]/[0.04] to-transparent overflow-hidden hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(152,60%,42%)] to-[hsl(170,50%,40%)] flex items-center justify-center shadow-lg shadow-[hsl(152,60%,42%)]/15">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-mono text-[hsl(152,60%,52%)] bg-[hsl(152,60%,42%)]/10 px-2.5 py-0.5 rounded-full">Étape 4</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">Des garde-fous à chaque niveau</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    AIGB intègre des mécanismes de sécurité avancés pour que rien ne passe entre les mailles du filet.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { icon: Fingerprint, label: "Multi-signature", desc: "Plusieurs admins valident les actions critiques.", color: "text-[hsl(280,50%,60%)]" },
                      { icon: KeyRound, label: "Code PIN unique", desc: "Chaque admin a un code pour les opérations sensibles.", color: "text-[hsl(38,85%,58%)]" },
                      { icon: Gauge, label: "Quotas journaliers", desc: "Limites sur les actions risquées.", color: "text-[hsl(0,72%,60%)]" },
                      { icon: History, label: "Audit & rollback", desc: "Chaque action tracée et réversible.", color: "text-[hsl(210,70%,60%)]" },
                      { icon: FlaskConical, label: "Politique sandbox", desc: "Test obligatoire avant la production.", color: "text-[hsl(152,60%,52%)]" },
                      { icon: Timer, label: "Rate limiting", desc: "Contrôle des requêtes par agent.", color: "text-[hsl(190,60%,55%)]" },
                    ].map(({ icon: Icon, label, desc, color }) => (
                      <div key={label} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                        <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                        <div>
                          <span className="text-sm font-medium text-white/70">{label}</span>
                          <p className="text-xs text-white/35 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative p-7 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[hsl(210,70%,50%)]/[0.04] to-transparent overflow-hidden hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-start gap-5 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(210,70%,50%)] to-[hsl(230,60%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(210,70%,50%)]/15">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-mono text-[hsl(210,70%,60%)] bg-[hsl(210,70%,50%)]/10 px-2.5 py-0.5 rounded-full">Étape 5</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">Identifiez chaque utilisateur</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    Chaque personne qui utilise un agent possède un <strong className="text-white/60">rôle d'opérateur</strong> (Admin, Opérateur, Lecteur)
                    qui détermine ses droits. Avant d'exécuter une action sensible, l'utilisateur doit fournir sa <strong className="text-white/60">clé unique personnelle</strong> pour
                    prouver son identité — sans jamais avoir besoin d'un compte sur la plateforme.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {[
                      { icon: KeyRound, label: "Clé unique", desc: "Identifie l'opérateur à chaque action.", color: "text-[hsl(38,85%,58%)]" },
                      { icon: Shield, label: "Rôles granulaires", desc: "Admin, Opérateur ou Lecteur par agent.", color: "text-[hsl(280,50%,60%)]" },
                      { icon: Lock, label: "Sans compte requis", desc: "Pas besoin de créer un compte utilisateur.", color: "text-[hsl(190,60%,55%)]" },
                    ].map(({ icon: Icon, label, desc, color }) => (
                      <div key={label} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                        <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                        <div>
                          <span className="text-sm font-medium text-white/70">{label}</span>
                          <p className="text-xs text-white/35 mt-0.5">{desc}</p>
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

      {/* Sign-up form */}
      <section id="signup" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">Rejoignez la liste d'attente</h2>
          <p className="text-white/40 text-center mb-12">
            Soyez parmi les premiers à sécuriser vos agents IA avec AIGB.
          </p>

          {submitted ? (
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[hsl(152,60%,42%)]/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-[hsl(152,60%,52%)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Merci pour votre inscription !</h3>
                <p className="text-white/40">
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
                    className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[hsl(24,80%,55%)]/30 transition-all duration-300 text-left group"
                  >
                    <Building2 className="w-8 h-8 text-[hsl(24,80%,55%)] mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-lg mb-1.5 tracking-tight">Entreprise</h3>
                    <p className="text-sm text-white/40">
                      Sécurisez les agents IA de votre organisation
                    </p>
                  </button>
                  <button
                    onClick={() => setProspectType("individual")}
                    className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[hsl(24,80%,55%)]/30 transition-all duration-300 text-left group"
                  >
                    <User className="w-8 h-8 text-[hsl(24,80%,55%)] mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-lg mb-1.5 tracking-tight">Particulier</h3>
                    <p className="text-sm text-white/40">
                      Gardez le contrôle sur vos outils IA personnels
                    </p>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setProspectType(null)}
                    className="text-sm text-white/35 hover:text-white/60 transition-colors mb-2"
                  >
                    ← {prospectType === "enterprise" ? "Entreprise" : "Particulier"} · Changer
                  </button>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white/60 text-xs font-medium">Prénom *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        required
                        maxLength={100}
                        value={form.firstName}
                        onChange={handleChange}
                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                        placeholder="Jean"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white/60 text-xs font-medium">Nom *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        required
                        maxLength={100}
                        value={form.lastName}
                        onChange={handleChange}
                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/60 text-xs font-medium">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      value={form.email}
                      onChange={handleChange}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                      placeholder="jean@exemple.com"
                    />
                  </div>

                  {prospectType === "enterprise" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-white/60 text-xs font-medium">Entreprise *</Label>
                        <Input
                          id="company"
                          name="company"
                          required
                          maxLength={200}
                          value={form.company}
                          onChange={handleChange}
                          className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle" className="text-white/60 text-xs font-medium">Poste</Label>
                        <Input
                          id="jobTitle"
                          name="jobTitle"
                          maxLength={200}
                          value={form.jobTitle}
                          onChange={handleChange}
                          className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                          placeholder="CTO"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white/60 text-xs font-medium">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={handleChange}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white/60 text-xs font-medium">Message (optionnel)</Label>
                    <Textarea
                      id="message"
                      name="message"
                      maxLength={1000}
                      value={form.message}
                      onChange={handleChange}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-lg min-h-[80px] focus:border-[hsl(24,80%,55%)]/50 focus:ring-[hsl(24,80%,55%)]/20"
                      placeholder="Dites-nous en plus sur votre besoin…"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[hsl(24,80%,50%)] hover:bg-[hsl(24,80%,45%)] text-white h-12 text-base rounded-xl shadow-lg shadow-[hsl(24,80%,50%)]/20"
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
      <footer className="border-t border-white/[0.04] py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/25">
          <div className="flex items-center gap-2">
            <img src={aigbLogo} alt="AIGB" className="h-5 opacity-40" />
            <span>© {new Date().getFullYear()} AIGB. Tous droits réservés.</span>
          </div>
          <span className="font-medium tracking-wide">Make the future safe.</span>
        </div>
      </footer>
    </div>
  );
}
