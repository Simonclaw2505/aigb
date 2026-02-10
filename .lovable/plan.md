

## Projet actif global + persistance des imports API

### Ce qui change

Le projet selectionne sur la page "Projects" devient le contexte global pour toutes les pages du workflow. Les pages Permissions, Simulator et Export n'auront plus leur propre selecteur de projet -- elles utiliseront le projet actif defini globalement.

Les imports API (api_sources, endpoints, connecteurs) sont deja sauvegardes en base de donnees. Le probleme actuel est que le formulaire ManualApiConfig repart toujours a zero au lieu d'afficher les APIs deja configurees pour le projet.

### 1. Banniere "Projet actif" sur toutes les pages workflow

Ajouter un composant reutilisable `ProjectBanner` qui affiche le nom du projet actif en haut de chaque page workflow (Import, Actions, Permissions, Simulator, Export). Si aucun projet n'est selectionne, un message invite l'utilisateur a en choisir un sur la page Projects, et le contenu de la page est bloque.

### 2. Supprimer les selecteurs de projet des pages workflow

- **Permissions.tsx** : Supprimer le `Select` de projet (lignes 128-153). Utiliser `useCurrentProject()` a la place de la logique locale de fetch projets.
- **Simulator.tsx** : Supprimer le `Select` de projet (lignes 105-107, 145-169). Utiliser `useCurrentProject()`.
- **Export.tsx** : Supprimer le `Select`/`<select>` de projet (lignes 56-57, 73-100, 170-197). Utiliser `useCurrentProject()`.
- **Actions.tsx** : Deja base sur `useCurrentProject()`, mais les endpoints ne sont pas filtres par projet. Ajouter un filtre `api_sources.project_id`.

### 3. Bloquer l'acces au workflow sans projet

Dans la sidebar (`AppSidebar.tsx`), les liens "Workflow" (Import, Actions, Permissions, Simulator, Export) ne seront pas desactives visuellement (trop complexe pour la sidebar), mais chaque page affichera un message bloquant si `currentProject` est null, redirigeant vers `/projects`.

### 4. Afficher les APIs deja configurees dans Import

Dans la page `Import.tsx`, ajouter une section "APIs configurees" qui charge les `api_sources` du projet courant depuis la base. Chaque source affiche son nom, le nombre d'endpoints, et un bouton supprimer. Cela evite de devoir reconfigurer l'API a chaque visite.

### 5. Suppression d'une API source

Ajouter un bouton supprimer avec confirmation (AlertDialog) pour chaque API source. La suppression suit cet ordre :
1. Supprimer les `action_templates` liees aux endpoints de cette source
2. Supprimer les `endpoints` de cette source
3. Supprimer les `api_connectors` lies a cette source
4. Supprimer l'`api_source` elle-meme

### 6. Filtrer les endpoints par projet dans Actions

Modifier `fetchData` dans `Actions.tsx` pour ne charger que les endpoints dont l'`api_source` appartient au projet courant, via une jointure :
```text
supabase.from("endpoints")
  .select("*, api_sources!inner(project_id)")
  .eq("api_sources.project_id", currentProject.id)
```

---

### Fichiers a creer

- **`src/components/layout/ProjectBanner.tsx`** : Composant affichant le projet actif ou un message d'erreur. Utilise `useCurrentProject()`.

### Fichiers a modifier

- **`src/pages/Import.tsx`** : Ajouter la section "APIs configurees" avec liste et suppression
- **`src/pages/Actions.tsx`** : Filtrer endpoints par projet via jointure api_sources
- **`src/pages/Permissions.tsx`** : Remplacer le selecteur local par `useCurrentProject()` + `ProjectBanner`
- **`src/pages/Simulator.tsx`** : Remplacer le selecteur local par `useCurrentProject()` + `ProjectBanner`
- **`src/pages/Export.tsx`** : Remplacer le selecteur local par `useCurrentProject()` + `ProjectBanner`

### Pas de changement en base de donnees

Toutes les tables et relations necessaires existent deja (`api_sources.project_id`, `endpoints.api_source_id`, `api_connectors.api_source_id`, `action_templates.project_id`). Aucune migration SQL n'est requise.

