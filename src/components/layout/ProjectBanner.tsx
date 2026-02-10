import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, AlertCircle } from "lucide-react";

interface ProjectBannerProps {
  children?: React.ReactNode;
}

export function ProjectBanner({ children }: ProjectBannerProps) {
  const { currentProject, isLoading } = useCurrentProject();

  if (isLoading) return null;

  if (!currentProject) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Aucun agent sélectionné</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          Sélectionnez un agent sur la page{" "}
          <Button variant="link" className="h-auto p-0" asChild>
            <a href="/agents">Agents</a>
          </Button>{" "}
          pour continuer.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Bot className="h-4 w-4" />
        <span>Agent actif :</span>
        <Badge variant="secondary" className="font-medium">
          {currentProject.name}
        </Badge>
      </div>
      {children}
    </>
  );
}
