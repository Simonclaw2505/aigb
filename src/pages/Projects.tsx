/**
 * Projects page for MCP Foundry
 * List and manage all MCP conversion projects
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectSetup } from "@/components/onboarding/ProjectSetup";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, FolderOpen, MoreHorizontal, Calendar, Loader2, Check, Play, Pause, Archive, Trash2 } from "lucide-react";

// Status badge variants
const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
};

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { user } = useAuth();
  const {
    projects,
    organization,
    currentProject,
    isLoading,
    needsOnboarding,
    createDefaultProject,
    setCurrentProject,
    refetch,
  } = useCurrentProject();

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusChange = async (
    projectId: string,
    newStatus: "draft" | "active" | "archived",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", projectId);

      if (error) throw error;

      toast.success(
        `Projet ${newStatus === "active" ? "activé" : newStatus === "archived" ? "archivé" : "mis en brouillon"}`
      );
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour");
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !organization || !user) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
          organization_id: organization.id,
          created_by: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Projet créé avec succès !");
      setIsCreateOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setIsCreating(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <DashboardLayout title="Projects" description="Manage your MCP conversion projects">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Show onboarding if user needs to create first project
  if (needsOnboarding) {
    return (
      <DashboardLayout title="Projects" description="Manage your MCP conversion projects">
        <ProjectSetup
          onCreateProject={createDefaultProject}
          hasOrganization={!!organization}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Projects" description="Manage your MCP conversion projects">
      <div className="space-y-6">
        {/* Header with search and create */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Set up a new project to convert an API to MCP format
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My API Project"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the API..."
                    rows={3}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching projects" : "No projects yet"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first project to start converting APIs into MCP toolsets"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className={`hover:border-primary/50 transition-colors cursor-pointer ${
                  currentProject?.id === project.id ? "border-primary ring-1 ring-primary/20" : ""
                }`}
                onClick={() => setCurrentProject(project)}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">{project.name}</CardTitle>
                      {currentProject?.id === project.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <CardDescription className="mt-1 line-clamp-2">
                      {project.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {project.status === "draft" && (
                        <DropdownMenuItem onClick={(e) => handleStatusChange(project.id, "active", e)}>
                          <Play className="h-4 w-4 mr-2" />
                          Activer le projet
                        </DropdownMenuItem>
                      )}
                      {project.status === "active" && (
                        <DropdownMenuItem onClick={(e) => handleStatusChange(project.id, "draft", e)}>
                          <Pause className="h-4 w-4 mr-2" />
                          Repasser en brouillon
                        </DropdownMenuItem>
                      )}
                      {project.status !== "archived" && (
                        <DropdownMenuItem onClick={(e) => handleStatusChange(project.id, "archived", e)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archiver
                        </DropdownMenuItem>
                      )}
                      {project.status === "archived" && (
                        <DropdownMenuItem onClick={(e) => handleStatusChange(project.id, "draft", e)}>
                          <Play className="h-4 w-4 mr-2" />
                          Restaurer
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={statusVariants[project.status]}>
                      {project.status}
                    </Badge>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
