/**
 * Dashboard layout wrapper for AI Guard
 * Provides sidebar navigation and main content area
 */

import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Top header bar */}
          <header className="flex h-14 items-center gap-4 border-b border-border/60 bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-20">
            <SidebarTrigger className="-ml-2" />
            <Separator orientation="vertical" className="h-5" />
            {title && (
              <div className="flex flex-col">
                <h1 className="text-sm font-semibold text-foreground tracking-tight">{title}</h1>
                {description && (
                  <p className="text-[11px] text-muted-foreground">{description}</p>
                )}
              </div>
            )}
          </header>

          {/* Main content */}
          <main className="flex-1 p-6 animate-fade-in">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
