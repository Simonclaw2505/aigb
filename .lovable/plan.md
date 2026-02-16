
# Refonte de la page Permissions : Roles par agent avec outils et actions

## Probleme actuel

La page Permissions affiche encore les anciens roles organisationnels (owner, admin, member, viewer) avec des types de ressources generiques. Elle ne reflete pas le nouveau systeme d'operateurs lies aux agents.

## Nouvelle approche

Transformer la page Permissions en une vue centree sur l'agent selectionne, qui affiche :
1. Les **roles des operateurs** de cet agent (extraits de `operator_keys`)
2. Pour chaque role, les **outils** et **actions autorisees** (seulement celles deja configurees pour l'agent via `action_templates`)

## Flux utilisateur

```text
Permissions > Selectionner un agent
  -> Voir les roles existants (Admin, Operator, Viewer + roles custom)
  -> Cliquer sur un role pour voir/editer ses droits
  -> Cocher les outils accessibles et les actions autorisees par outil
  -> Seules les actions deja validees pour l'agent apparaissent
```

## Ce qui change dans l'interface

### 1. Selecteur d'agent en haut de page
- Dropdown pour choisir l'agent (comme sur la page Actions)
- Affiche les roles et permissions uniquement pour cet agent

### 2. Vue des roles de l'agent
- Afficher les roles distincts trouves dans `operator_keys` pour l'agent (ex: admin, member, viewer)
- Bouton pour ajouter un nouveau role (qui sera disponible lors de la creation d'operateurs)
- Chaque role est une carte cliquable/expandable

### 3. Matrice role -> outils -> actions
Pour chaque role, afficher :
- Les **outils lies a l'agent** (via `agent_tools` + `api_sources`)
- Pour chaque outil, les **actions configurees** (via `action_templates` pour cet agent)
- Des checkboxes pour autoriser/refuser chaque action par role
- Cela cree/modifie des entrees dans `user_permission_rules` avec le bon `agent_id`, `subject_role` et `resource_id` (l'action)

### 4. Conservation de l'onglet Audit Logs
- L'onglet "Audit Logs" reste inchange

## Modifications techniques

### Fichier `src/pages/Permissions.tsx`
- Ajouter un selecteur d'agent en haut (comme les autres pages)
- Passer l'agent selectionne au composant de permissions

### Fichier `src/components/permissions/UserPermissionsPanel.tsx` (refonte)
- Remplacer la vue RBAC generique par une vue centree sur les roles operateurs
- Charger les roles distincts depuis `operator_keys` pour l'agent selectionne
- Charger les outils lies a l'agent (`agent_tools` + `api_sources`)
- Charger les actions configurees (`action_templates` pour cet agent)
- Afficher une matrice : lignes = actions groupees par outil, colonnes = roles
- Checkboxes pour definir les permissions
- Chaque modification cree/met a jour une regle `user_permission_rules` avec `agent_id`, `subject_role`, `resource_type: "action"`, `resource_id: action_template.id`, `action: "execute"`, `effect: "allow" ou "deny"`

### Fichier `src/hooks/usePermissions.ts`
- Ajouter un hook `useAgentRoles(agentId)` pour recuperer les roles distincts depuis `operator_keys`
- Ajouter un hook `useAgentActions(agentId)` pour recuperer les outils + actions configurees
- Modifier `useUserPermissionRules` pour accepter un filtre par `agent_id`

### Migration SQL (aucune necessaire)
Les tables existantes supportent deja tout :
- `operator_keys` contient les roles par agent
- `user_permission_rules` a deja `agent_id`, `subject_role`, `resource_id`
- `action_templates` + `agent_tools` + `api_sources` permettent de lister les actions par agent

## Structure de la matrice de permissions

```text
Agent: "Sales Bot"
  
  Role: Admin
    [x] Outil "Stripe" 
        [x] create-refund
        [x] get-payment
    [x] Outil "CRM"
        [x] update-contact
        [x] delete-contact
  
  Role: Operator  
    [x] Outil "Stripe"
        [ ] create-refund    <- pas autorise
        [x] get-payment
    [x] Outil "CRM"
        [x] update-contact
        [ ] delete-contact   <- pas autorise
  
  Role: Viewer
    [x] Outil "Stripe"
        [x] get-payment      <- lecture seule
    [ ] Outil "CRM"          <- aucun acces
```

## Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/pages/Permissions.tsx` | Ajout selecteur d'agent, passage du contexte |
| `src/components/permissions/UserPermissionsPanel.tsx` | Refonte complete : vue roles operateurs + matrice outils/actions |
| `src/hooks/usePermissions.ts` | Nouveaux hooks `useAgentRoles`, `useAgentActions`, filtre par agent |
