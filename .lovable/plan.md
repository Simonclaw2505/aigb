
# Correction : Permettre la création d'actions

## Problème identifié

La page Actions ne fonctionne pas car elle utilise un **ID de projet temporaire fictif** (`00000000-0000-0000-0000-000000000000`) qui n'existe pas dans la base de données.

La politique de sécurité (RLS) de la table `action_templates` vérifie que l'utilisateur a un rôle valide dans l'organisation du projet. Comme le projet fictif n'existe pas, cette vérification échoue systématiquement.

## Solution

Utiliser le vrai projet de l'utilisateur (`currentProject.id`) au lieu de l'ID fictif.

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/pages/Actions.tsx` | Intégrer le hook `useCurrentProject` et remplacer toutes les utilisations de `TEMP_PROJECT_ID` par `currentProject.id` |

## Détails techniques

### 1. Importer et utiliser le hook

```typescript
import { useCurrentProject } from "@/hooks/useCurrentProject";

export default function Actions() {
  const { currentProject, isLoading: projectLoading, needsOnboarding } = useCurrentProject();
  // ...
}
```

### 2. Remplacer les 4 occurrences de TEMP_PROJECT_ID

Toutes les insertions dans `action_templates` utiliseront `currentProject.id` :

- Ligne 276 : `handleSaveAction` (création/mise à jour)
- Ligne 373 : `handleDuplicateAction` (duplication)  
- Ligne 422 : `handleAutoGenerateAll` (génération automatique)

### 3. Gérer le cas où aucun projet n'existe

Si l'utilisateur n'a pas encore de projet, afficher un message l'invitant à en créer un depuis la page Projects ou l'onboarding.

### 4. Supprimer la constante inutilisée

Retirer `const TEMP_PROJECT_ID = "00000000-0000-0000-0000-000000000000";`

## Résultat attendu

Après cette modification, les actions seront créées avec le vrai ID de projet de l'utilisateur. La politique RLS pourra alors vérifier correctement que l'utilisateur a les permissions nécessaires, et la création fonctionnera.
