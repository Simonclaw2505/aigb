

# Ajouter la gestion du statut des projets

## Problème

Le bouton "⋯" sur chaque carte de projet est présent mais ne fait rien. Il n'existe aucun moyen de :
- Passer un projet de "draft" à "active"
- Archiver un projet
- Modifier ou supprimer un projet

## Solution

Ajouter un menu déroulant (DropdownMenu) au bouton "⋯" avec des actions de gestion du projet.

## Fichier à modifier

### `src/pages/Projects.tsx`

**1. Ajouter les imports nécessaires** :

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, Archive, Pencil, Trash2 } from "lucide-react";
```

**2. Ajouter une fonction pour changer le statut** :

```typescript
const handleStatusChange = async (
  projectId: string, 
  newStatus: "draft" | "active" | "archived",
  e: React.MouseEvent
) => {
  e.stopPropagation(); // Empêcher la sélection du projet
  
  try {
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    if (error) throw error;

    toast.success(`Projet ${newStatus === "active" ? "activé" : newStatus === "archived" ? "archivé" : "mis en brouillon"}`);
    refetch();
  } catch (error: any) {
    toast.error(error.message || "Erreur lors de la mise à jour");
  }
};
```

**3. Remplacer le bouton MoreHorizontal par un DropdownMenu** :

```typescript
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
```

## Résumé des actions disponibles

| Statut actuel | Actions disponibles |
|---------------|---------------------|
| draft | Activer, Archiver, Supprimer |
| active | Repasser en brouillon, Archiver, Supprimer |
| archived | Restaurer, Supprimer |

## Comportement après correction

1. Tu cliques sur "⋯" d'un projet draft
2. Menu apparaît avec "Activer le projet"
3. Tu cliques → statut passe à "active"
4. Le badge devient vert "active"
5. Tu peux maintenant exporter ce projet

