/**
 * ProjectSetup - Onboarding component for first-time users
 * Guides users through creating their first organization and project
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Rocket, FolderPlus } from "lucide-react";

interface ProjectSetupProps {
  onCreateProject: (projectName: string, orgName?: string) => Promise<any>;
  hasOrganization: boolean;
}

export function ProjectSetup({ onCreateProject, hasOrganization }: ProjectSetupProps) {
  const [projectName, setProjectName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateProject(
        projectName.trim(),
        !hasOrganization ? orgName.trim() || undefined : undefined
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {hasOrganization ? "Créer votre premier projet" : "Bienvenue sur MCP Foundry"}
          </CardTitle>
          <CardDescription>
            {hasOrganization
              ? "Créez un projet pour commencer à importer vos APIs"
              : "Configurez votre espace de travail pour commencer"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!hasOrganization && (
              <div className="space-y-2">
                <Label htmlFor="org-name">Nom de l'organisation</Label>
                <Input
                  id="org-name"
                  placeholder="Mon Équipe"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Optionnel — un nom par défaut sera utilisé si laissé vide
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-name">Nom du projet *</Label>
              <Input
                id="project-name"
                placeholder="Mon Projet API"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isCreating}
                required
              />
              <p className="text-xs text-muted-foreground">
                Le projet contiendra vos spécifications OpenAPI et actions MCP
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!projectName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Créer le projet
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
