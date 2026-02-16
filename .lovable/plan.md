

# Gestion des utilisateurs, roles par agent et permissions par role

## Constat actuel

Aujourd'hui, les utilisateurs n'ont qu'un role global au niveau de l'organisation (owner/admin/member/viewer via `organization_members`). Il n'y a pas de moyen de :
- Voir/gerer les membres de l'equipe
- Assigner un utilisateur a un agent specifique
- Donner un role different selon l'agent
- Definir quelles actions un role peut executer sur un agent donne

## Approche UX proposee

Le flux intuitif en 3 niveaux :

1. **Page "Team"** (nouvelle) : gerer les membres de l'organisation (inviter, voir, changer le role org)
2. **Page Agents** : sur chaque agent, assigner des membres avec un role specifique a cet agent
3. **Page Permissions** : definir quelles actions chaque role peut executer (scope par agent)

### Flux utilisateur concret

```text
Settings > Team
  -> Voir tous les membres de l'orga
  -> Inviter un nouveau membre par email
  -> Changer son role org (owner/admin/member/viewer)

Agents > [Mon Agent] > Menu "Gerer les membres"
  -> Voir qui a acces a cet agent
  -> Ajouter un membre de l'orga a l'agent
  -> Lui donner un role specifique pour cet agent (admin/operator/viewer)

Permissions > User Permissions
  -> Les regles RBAC/ABAC existantes, mais scopees par agent
  -> "Le role operator peut executer les actions read_only sur cet agent"
```

## Modifications techniques

### 1. Migration SQL - Nouvelles tables

**Table `agent_members`** : lie un utilisateur a un agent avec un role specifique

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| agent_id | uuid | FK vers projects |
| user_id | uuid | FK vers auth.users |
| role | app_role | Role de l'utilisateur sur cet agent |
| created_at | timestamptz | Date d'ajout |
| created_by | uuid | Qui a ajoute ce membre |

Contrainte unique sur (agent_id, user_id).

Politiques RLS :
- Les admins/owners de l'org peuvent gerer les membres d'agent
- Les membres de l'org peuvent voir les membres d'agent

**Fonction `get_agent_role`** : retourne le role d'un utilisateur sur un agent donne (utile pour les RLS et le moteur de permissions).

### 2. Page Team dans Settings

Ajouter un onglet **"Team"** dans `Settings.tsx` :

- Liste des membres de l'organisation avec leur email, nom, role org, date d'ajout
- Bouton "Inviter" qui ouvre un dialog avec : champ email + selecteur de role
- L'invitation cree un enregistrement `organization_members` (l'utilisateur doit avoir un compte)
- Actions : modifier le role, retirer de l'organisation

### 3. Dialog "Gerer les membres" sur les Agents

Ajouter dans le menu contextuel de chaque agent (a cote de "Gerer les outils") une option **"Gerer les membres"**.

Le dialog `ManageAgentMembersDialog` :
- Liste les membres actuels de l'agent avec leur role
- Selecteur pour ajouter un membre de l'org (combo avec les membres pas encore assignes)
- Selecteur de role par agent (admin / operator / viewer)
- Bouton supprimer pour retirer un membre

### 4. Mise a jour de la page Permissions

Modifier `UserPermissionsPanel` pour :
- Ajouter un champ optionnel "Agent" (scope) dans le formulaire de creation de regle
- Permettre de dire "Ce role sur cet agent peut executer ces actions"
- Afficher la colonne "Agent" dans le tableau des regles

Cela reutilise la table `user_permission_rules` existante en ajoutant une colonne optionnelle `agent_id` pour scoper les regles.

### 5. Integration dans evaluate-permission

Modifier la edge function pour :
- Verifier si l'utilisateur est membre de l'agent concerne
- Utiliser le role agent (pas le role org) pour evaluer les regles scopees par agent
- Fallback sur le role org si pas de role agent specifique

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Table `agent_members`, fonction `get_agent_role`, colonne `agent_id` sur `user_permission_rules` |
| `src/pages/Settings.tsx` | Nouvel onglet "Team" avec liste des membres et invitation |
| `src/components/settings/TeamPanel.tsx` | Nouveau composant : liste, invite, gestion des membres org |
| `src/pages/Projects.tsx` | Option "Gerer les membres" dans le menu contextuel des agents |
| `src/components/agents/ManageAgentMembersDialog.tsx` | Nouveau composant : assigner des membres a un agent avec un role |
| `src/components/permissions/UserPermissionsPanel.tsx` | Ajout du champ "Agent" (optionnel) dans le formulaire de regle |
| `src/components/layout/AppSidebar.tsx` | Pas de changement (Team est dans Settings) |
| `supabase/functions/evaluate-permission/index.ts` | Prendre en compte le role agent et les regles scopees |

## Recapitulatif du modele de donnees

```text
Organization
  └── Members (role org: owner/admin/member/viewer)
       └── Agents
            ├── Tools (outils lies)
            ├── Actions (avec politique, quotas, environnements)
            └── Agent Members (role par agent: admin/operator/viewer)
                 └── Permissions (regles RBAC/ABAC scopees par agent + role)
```

