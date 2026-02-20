

# Corriger les agents (edition, suppression) et le dashboard dynamique

## Problemes identifies

1. **Suppression impossible** : le bouton "Supprimer" dans le menu contextuel de chaque agent n'a aucun `onClick` -- il ne fait rien.
2. **Edition impossible** : il n'existe aucun moyen de modifier le nom ou la description d'un agent apres sa creation.
3. **Dashboard statique** : les trois compteurs (Agents, Outils connectes, Appels API) sont codes en dur a "0". L'activite recente est egalement statique.

---

## 1. Suppression d'agent avec confirmation

**Fichier** : `src/pages/Projects.tsx`

- Ajouter un state `deleteAgent` pour stocker l'agent a supprimer
- Ajouter un `AlertDialog` de confirmation ("Etes-vous sur de vouloir supprimer l'agent X ? Cette action est irreversible.")
- Au clic sur "Supprimer" dans le `DropdownMenu`, stocker l'agent cible dans `deleteAgent` (au lieu de rien faire)
- A la confirmation, executer `supabase.from("projects").delete().eq("id", agentId)` puis `refetch()`
- La politique RLS `Admins can delete projects` autorise deja les owners/admins a supprimer

## 2. Edition d'un agent existant

**Fichier** : `src/pages/Projects.tsx`

- Ajouter un state `editAgent` avec l'agent en cours d'edition
- Ajouter un `Dialog` d'edition avec les champs Nom et Description pre-remplis
- Ajouter une entree "Modifier" dans le `DropdownMenu` de chaque agent (avec une icone Pencil)
- A la sauvegarde, executer `supabase.from("projects").update({ name, description }).eq("id", agentId)` puis `refetch()`
- La politique RLS `Admins can update projects` autorise deja les owners/admins/members a modifier

## 3. Dashboard avec donnees reelles

**Fichier** : `src/pages/Dashboard.tsx`

- Importer `useCurrentProject` pour acceder a `projects`, `organization`
- Calculer les vraies statistiques :
  - **Agents** : `projects.length`
  - **Outils connectes** : requete `supabase.from("agent_tools").select("api_source_id")` puis compter les IDs uniques
  - **Appels API aujourd'hui** : requete `supabase.from("execution_runs").select("id", { count: "exact" }).gte("created_at", debutDuJour)`
- Pour l'activite recente, charger les 5 derniers `audit_logs` de l'organisation et les afficher avec l'action, la date et le type de ressource

---

## Details techniques

### Suppression (Projects.tsx)

```text
Nouveaux states :
  deleteAgent: { id, name } | null

Nouveau composant dans le JSX :
  <AlertDialog> avec titre, description, bouton Annuler et bouton Supprimer (variant destructive)

Handler :
  handleDelete(agentId) -> supabase delete + refetch + toast
```

### Edition (Projects.tsx)

```text
Nouveaux states :
  editAgent: { id, name, description } | null
  editName / editDesc (champs du formulaire)

Nouveau composant dans le JSX :
  <Dialog> avec Input (nom) + Textarea (description) + boutons Annuler/Enregistrer

Handler :
  handleEdit(agentId, name, desc) -> supabase update + refetch + toast
```

### Dashboard dynamique (Dashboard.tsx)

```text
Imports supplementaires :
  useCurrentProject, supabase, useState, useEffect

Logique :
  1. Recuperer projects.length pour le compteur Agents
  2. Requete agent_tools pour compter les outils uniques
  3. Requete execution_runs avec filtre created_at >= debut du jour pour les appels API
  4. Requete audit_logs (limit 5, order desc) pour l'activite recente

Affichage activite recente :
  Liste des 5 derniers logs avec icone, action, type de ressource et date relative
```

### Fichiers modifies

```text
src/pages/Projects.tsx    -- suppression + edition
src/pages/Dashboard.tsx   -- stats dynamiques + activite recente
```

Aucune modification de schema ou migration necessaire -- les tables et politiques RLS existantes couvrent tous les cas.

