

# Option A : Fusionner Agent Capabilities dans les Actions et supprimer l'onglet

## Objectif

Centraliser toute la configuration de securite agent (politique, quotas, environnements) dans le formulaire d'action (`ActionBuilderForm`), et retirer l'onglet "Agent Capabilities" de la page Permissions.

## Etapes

### 1. Migration SQL - Ajouter les colonnes a `action_templates`

Ajouter 5 colonnes a la table `action_templates` :
- `max_executions_per_hour` (integer, nullable)
- `max_executions_per_day` (integer, nullable)
- `allowed_environments` (text array, default `{development,staging,production}`)
- `agent_policy` (utilise le type enum `agent_capability_policy` existant, default `allow`)
- `approval_roles` (app_role array, default `{owner,admin}`)

### 2. `ActionBuilderForm.tsx` - Ajouter les champs dans l'onglet Constraints

Mettre a jour `ActionFormData` :
```text
agentPolicy: 'allow' | 'deny' | 'require_confirmation' | 'require_approval'
approvalRoles: string[]
maxExecutionsPerHour?: number
maxExecutionsPerDay?: number
allowedEnvironments: string[]
```

Ajouter 3 cartes dans l'onglet Constraints :

- **Agent Policy** : selecteur Allow/Deny/Require Confirmation/Require Approval, avec checkboxes des roles d'approbation quand policy = require_approval
- **Execution Quotas** : champs Max Executions/Hour et Max Executions/Day
- **Allowed Environments** : checkboxes Development, Staging, Production

### 3. `Actions.tsx` - Mapper les nouveaux champs

- Dans `ActionTemplate` interface : ajouter les 5 nouveaux champs
- Dans `handleSaveAction` : inclure `agent_policy`, `approval_roles`, `max_executions_per_hour`, `max_executions_per_day`, `allowed_environments`
- Dans `createFormDataFromAction` : lire ces champs depuis l'action existante
- Dans `createFormDataFromEndpoint` : valeurs par defaut (allow, pas de limite, tous les environnements)
- Dans `handleAutoGenerateAll` et `handleDuplicateAction` : inclure les nouveaux champs

### 4. `Permissions.tsx` - Retirer l'onglet Agent Capabilities

- Supprimer l'import de `AgentCapabilitiesPanel` et de `Bot`
- Supprimer le fetch des `actionTemplates` (plus necessaire)
- Supprimer l'onglet "Agent Capabilities" et son contenu
- Ne garder que 2 onglets : "User Permissions" et "Audit Logs"
- Tab par defaut : `user` au lieu de `agent`
- Adapter le badge compteur et la description

### 5. `evaluate-permission/index.ts` - Lire depuis `action_templates`

Remplacer la lecture depuis `agent_capabilities` par une lecture directe depuis `action_templates` :
- Charger `agent_policy`, `approval_roles`, `max_executions_per_hour`, `max_executions_per_day`, `allowed_environments` depuis `action_templates`
- Appliquer la meme logique de deny/confirm/approve/rate-limit
- Logger dans `permission_evaluations` comme avant

## Detail technique

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| Migration SQL | 5 nouvelles colonnes sur `action_templates` |
| `src/components/actions/ActionBuilderForm.tsx` | Extension de `ActionFormData` + 3 cartes Agent Policy, Quotas, Environments dans l'onglet Constraints |
| `src/pages/Actions.tsx` | Mapper les 5 nouveaux champs dans save/load/auto-generate/duplicate |
| `src/pages/Permissions.tsx` | Retirer l'onglet Agent Capabilities, garder User Permissions + Audit Logs |
| `supabase/functions/evaluate-permission/index.ts` | Lire politique et quotas depuis `action_templates` au lieu de `agent_capabilities` |

### Fichiers non supprimes (mais plus utilises par Permissions.tsx)

- `src/components/permissions/AgentCapabilitiesPanel.tsx` : ne sera plus importe par Permissions.tsx mais reste dans le code (peut etre supprime plus tard si on veut)
- `src/hooks/usePermissions.ts` : le hook `useAgentCapabilities` ne sera plus utilise par la page Permissions mais reste disponible

