import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, AlertCircle } from "lucide-react";

interface ProjectBannerProps {
  /** If true, returns children only when project is selected, otherwise shows blocker */
  children?: React.ReactNode;
}

export function ProjectBanner({ children }: ProjectBannerProps) {
  const { currentProject, isLoading } = useCurrentProject();

  if (isLoading) return null;

  if (!currentProject) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Aucun projet sélectionné</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          Sélectionnez un projet sur la page{" "}
          <Button variant="link" className="h-auto p-0" asChild>
            <a href="/projects">Projets</a>
          </Button>{" "}
          pour continuer.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <FolderOpen className="h-4 w-4" />
        <span>Projet actif :</span>
        <Badge variant="secondary" className="font-medium">
          {currentProject.name}
        </Badge>
      </div>
      {children}
    </>
  );
}
