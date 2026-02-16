

# Charger les endpoints par outils lies dans Actions

## Probleme actuel

La page Actions charge les endpoints via `api_sources.project_id = currentProject.id`. Cela ne fonctionne plus car les outils (`api_sources`) sont maintenant globaux a l'organisation et lies aux agents via `agent_tools`, pas via `project_id`.

## Solution

Modifier `fetchData()` dans `Actions.tsx` pour :

1. D'abord recuperer les `api_source_id` lies a l'agent courant via `agent_tools`
2. Puis charger les endpoints de ces sources uniquement
3. Grouper l'affichage des endpoints par outil pour plus de lisibilite

## Modifications dans `src/pages/Actions.tsx`

### 1. Nouveau fetch via agent_tools

Remplacer la requete endpoints actuelle :

```text
// AVANT (ne fonctionne plus)
supabase.from("endpoints")
  .select("*, api_sources!inner(project_id)")
  .eq("api_sources.project_id", currentProject.id)

// APRES (via les outils lies)
// Etape 1 : recuperer les outils lies
const { data: linkedTools } = await supabase
  .from("agent_tools")
  .select("api_source_id, api_sources(id, name)")
  .eq("agent_id", currentProject.id);

// Etape 2 : charger les endpoints de ces outils
const sourceIds = linkedTools.map(t => t.api_source_id);
const { data: endpointsData } = await supabase
  .from("endpoints")
  .select("*")
  .in("api_source_id", sourceIds);
```

### 2. Grouper les endpoints par outil

Ajouter un state `toolsMap` pour afficher un en-tete par outil dans l'onglet Endpoints :

```text
// Affichage :
// --- SendGrid ---
//   GET /v3/scopes
//   POST /v3/mail/send
// --- Stripe ---
//   GET /v1/customers
```

Chaque groupe aura un petit titre avec le nom de l'outil et un separateur visuel.

### 3. Message vide adapte

Si aucun outil n'est lie a l'agent, afficher un message specifique :
- "Aucun outil lie a cet agent"
- Bouton "Gerer les outils" qui redirige vers `/agents`

### 4. Stocker le nom de l'outil sur chaque endpoint

Enrichir l'interface `Endpoint` avec `sourceName` et `sourceId` pour pouvoir grouper et afficher proprement.

## Fichier modifie

| Fichier | Modification |
|---------|-------------|
| `src/pages/Actions.tsx` | Refactorer `fetchData` pour passer par `agent_tools`, grouper endpoints par outil, adapter le message vide |

## Aucune migration necessaire

Toutes les tables et relations existent deja.

