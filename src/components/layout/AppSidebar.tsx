/**
 * Main sidebar navigation for MCP Foundry
 * Clean, minimal design with icon-based navigation
 */

import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Zap,
  FolderOpen,
  Upload,
  Play,
  Shield,
  TestTube,
  FileText,
  Download,
  LogOut,
  Settings,
  LayoutDashboard,
} from "lucide-react";

// Navigation items grouped by section
const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
];

const workflowItems = [
  { title: "API Import", url: "/import", icon: Upload },
  { title: "Actions", url: "/actions", icon: Play },
  { title: "Permissions", url: "/permissions", icon: Shield },
  { title: "Simulator", url: "/simulator", icon: TestTube },
  { title: "Export", url: "/export", icon: Download },
];

const adminItems = [
  { title: "Audit Logs", url: "/audit-logs", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const renderNavItems = (items: typeof mainNavItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive(item.url)}>
            <NavLink
              to={item.url}
              end
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  // Get user initials for avatar
  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <Sidebar
      className="border-r border-sidebar-border"
      collapsible="icon"
    >
      {/* Header with logo */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-accent-foreground text-sm">
              MCP Foundry
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3 mb-2">
              Main
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNavItems(mainNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* Workflow */}
        <SidebarGroup className="mt-6">
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3 mb-2">
              Workflow
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNavItems(workflowItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* Admin */}
        <SidebarGroup className="mt-6">
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3 mb-2">
              Admin
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNavItems(adminItems)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user info */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-sidebar-accent-foreground truncate">
                {user?.email}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
