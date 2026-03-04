/**
 * AppSidebar — Navigation principale AIGB
 * Vocabulaire orienté patron PME, groupé en 3 zones logiques
 */
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Zap, Bot, Wrench, Download, Play, Shield, TestTube,
  FileText, LogOut, Settings, LayoutDashboard, ShieldCheck,
  Activity, Plug, KeyRound, HelpCircle,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import aigbLogo from "@/assets/aigb-logo.png";

// ── Zones de navigation ──────────────────────────────────────────────────────

const cockpitItems = [
  {
    title: "Vue d'ensemble",
    url: "/dashboard",
    icon: LayoutDashboard,
    hint: "Votre tableau de bord principal — statut du système, checklist de démarrage et activité récente.",
  },
  {
    title: "Activité récente",
    url: "/audit-logs",
    icon: Activity,
    hint: "Historique complet de toutes les actions effectuées par vos agents IA.",
  },
];

const configItems = [
  {
    title: "Mes applications",
    url: "/tools",
    icon: Plug,
    hint: "Connectez vos APIs métier (CRM, ERP, email…) pour les mettre à disposition de vos agents.",
  },
  {
    title: "Mes agents IA",
    url: "/agents",
    icon: Bot,
    hint: "Créez et gérez les agents IA de votre organisation. Chaque agent a ses propres droits.",
  },
  {
    title: "Actions autorisées",
    url: "/actions",
    icon: Wrench,
    hint: "Définissez quelles actions chaque agent peut effectuer dans vos applications.",
  },
  {
    title: "Règles & permissions",
    url: "/permissions",
    icon: Shield,
    hint: "Contrôlez finement ce que chaque agent peut faire : autoriser, bloquer ou demander approbation.",
  },
];

const supervisionItems = [
  {
    title: "Connecter un agent IA",
    url: "/export",
    icon: Download,
    hint: "Récupérez l'endpoint MCP pour connecter Claude, GPT ou tout autre agent IA.",
  },
  {
    title: "Tester mon agent",
    url: "/simulator",
    icon: TestTube,
    hint: "Simulez des appels d'agents avant de les mettre en production.",
  },
  {
    title: "Audit sécurité",
    url: "/security",
    icon: ShieldCheck,
    hint: "Score de sécurité de votre plateforme et recommandations d'amélioration.",
  },
  {
    title: "Paramètres",
    url: "/settings",
    icon: Settings,
    hint: "Gérez votre organisation, vos clés d'accès et les membres de votre équipe.",
  },
];

// ── Composant ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "U";

  const renderItem = (item: typeof cockpitItems[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <NavLink
          to={item.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-sidebar-accent/60"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
        >
          <item.icon className="h-[18px] w-[18px] shrink-0 opacity-70" />
          {!collapsed && <span className="flex-1 text-[13px] font-medium">{item.title}</span>}
          {!collapsed && (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] text-xs">
                  {item.hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderGroup = (
    label: string,
    items: typeof cockpitItems,
    className = ""
  ) => (
    <SidebarGroup className={className}>
      {!collapsed && (
        <SidebarGroupLabel className="text-sidebar-muted/50 text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-1.5">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">{items.map(renderItem)}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      {/* Logo */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <img src={aigbLogo} alt="AIGB" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-sidebar-accent-foreground text-sm block tracking-tight">
                AIGB
              </span>
              <span className="text-[10px] text-sidebar-muted/50 block leading-none mt-0.5">
                AI Governance Board
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2.5 py-4 gap-0">
        {renderGroup("Tableau de bord", cockpitItems)}
        {renderGroup("Configuration", configItems, "mt-6")}
        {renderGroup("Supervision", supervisionItems, "mt-6")}
      </SidebarContent>

      {/* Footer — user + statut */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        {/* Status indicator */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-lg bg-[hsl(152,60%,42%)]/8 border border-[hsl(152,60%,42%)]/15">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(152,60%,42%)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(152,60%,42%)]" />
            </span>
            <span className="text-xs text-[hsl(152,60%,52%)] font-medium">Système actif</span>
          </div>
        )}
        {/* User */}
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-sidebar-accent-foreground truncate font-medium">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-8 w-8 shrink-0 text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
