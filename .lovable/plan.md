

# Cles d'operateur : Identites sans compte pour les utilisateurs d'agents

## Concept

L'admin cree des "operateurs" (personnes de l'entreprise) directement dans AIGB. Chaque operateur recoit une cle unique (ex: `aigb_op_xxxxxxxx`). Ces operateurs sont lies a un ou plusieurs agents avec un role specifique.

Quand quelqu'un demande une action a l'agent et que celle-ci exige une verification de role, le systeme demande la cle de verification. La cle identifie l'operateur, son role sur l'agent, et le systeme verifie les permissions.

**Aucun compte utilisateur n'est necessaire pour les operateurs.**

## Flux utilisateur

```text
1. Admin va dans Agents > [Mon Agent] > "Gerer les operateurs"
2. Clique "Ajouter un operateur"
3. Saisit : Nom (ex: "Jean Dupont"), Role (admin/operator/viewer)
4. Le systeme genere une cle unique : aigb_op_xxxxxxxxxx
5. L'admin copie la cle et la transmet a Jean (elle ne sera plus jamais affichee)

--- Plus tard ---

6. Jean (ou un agent IA agissant pour Jean) demande une action
7. L'action a une politique "require_confirmation" ou "require_approval"
8. Le systeme demande : "Veuillez saisir votre cle de verification"
9. Jean entre sa cle
10. Le systeme identifie Jean, verifie son role, et autorise ou refuse
```

## Modifications techniques

### 1. Migration SQL - Table `operator_keys`

Nouvelle table `operator_keys` :

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| agent_id | uuid | FK vers projects (l'agent) |
| organization_id | uuid | FK vers organizations |
| name | text | Nom de l'operateur (ex: "Jean Dupont") |
| role | app_role | Role sur cet agent (admin/member/viewer) |
| key_hash | text | Hash SHA-256 de la cle |
| key_prefix | text | Prefixe visible (ex: "aigb_op_xxxxxx") |
| is_active | boolean | Cle active ou revoquee |
| last_used_at | timestamptz | Derniere utilisation |
| usage_count | integer | Compteur d'utilisations |
| created_by | uuid | Admin qui a cree l'operateur |
| created_at | timestamptz | Date de creation |

Contrainte unique sur `key_hash`. Index sur `agent_id`.

Politiques RLS :
- Les admins/owners de l'org peuvent tout faire (ALL)
- Les membres de l'org peuvent voir (SELECT)

On supprime la table `agent_members` qui n'est plus pertinente (les operateurs n'ont pas de `user_id`).

Ajout d'une fonction SQL `get_operator_by_key_hash(hash text)` qui retourne l'operateur correspondant.

### 2. Refactoring du dialog "Gerer les membres" en "Gerer les operateurs"

Remplacer `ManageAgentMembersDialog.tsx` par `ManageOperatorsDialog.tsx` :

- **Liste** des operateurs existants de l'agent (nom, role, prefixe de cle, derniere utilisation, statut)
- **Ajouter un operateur** : formulaire avec Nom + Role, genere la cle et l'affiche une seule fois (meme UX que les API Keys)
- **Modifier le role** d'un operateur existant
- **Revoquer/Supprimer** un operateur

### 3. Mise a jour de la page Agents (Projects.tsx)

- Renommer le menu "Gerer les membres" en "Gerer les operateurs"
- Icone `KeyRound` au lieu de `Users`

### 4. Suppression du TeamPanel

La page Settings > Team qui gerait les membres org avec comptes n'est plus necessaire pour ce flux. On la retire de `Settings.tsx`.

### 5. Integration dans le Simulateur et l'action-runner

Quand une action exige une verification de role :

**Simulateur (frontend)** :
- Apres le dry-run, si une etape a `requires_confirmation` ou `requires_approval`, afficher un champ "Cle de verification" au lieu de simplement un bouton Confirm
- A la soumission de la cle, appeler une edge function `verify-operator-key` qui retourne le nom de l'operateur et son role
- Afficher "Identifie comme : Jean Dupont (Operator)" et verifier si le role autorise l'action

**Edge function `verify-operator-key`** :
- Recoit `{ key, agent_id }`
- Hash la cle, cherche dans `operator_keys`
- Retourne `{ valid, operator_name, role, operator_id }` ou erreur
- Met a jour `last_used_at` et `usage_count`

**Edge function `evaluate-permission`** :
- Ajouter un parametre optionnel `operator_key_hash` dans le contexte
- Si present, resoudre le role depuis `operator_keys` au lieu de `agent_members`
- Evaluer les regles de permission avec ce role

**Edge function `action-runner`** :
- Accepter un header `X-Operator-Key` en plus de `X-API-Key` et `Authorization`
- Si `X-Operator-Key` est fourni, identifier l'operateur et utiliser son role pour l'evaluation des permissions

### 6. Mise a jour des permissions (UserPermissionsPanel)

- Le champ "Agent" scope reste pertinent
- Le champ "Role" fait maintenant reference au role de l'operateur sur l'agent
- Les regles s'appliquent aux operateurs identifies par leur cle

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Creer `operator_keys`, supprimer `agent_members`, fonction `get_operator_by_key_hash` |
| `src/components/agents/ManageAgentMembersDialog.tsx` | Remplacer par `ManageOperatorsDialog.tsx` : creer des operateurs avec cles |
| `src/pages/Projects.tsx` | Renommer "Gerer les membres" en "Gerer les operateurs" |
| `src/pages/Settings.tsx` | Retirer l'onglet "Team" |
| `src/components/settings/TeamPanel.tsx` | Supprime |
| `src/pages/Simulator.tsx` | Ajouter champ "Cle de verification" pour les etapes qui exigent une verification de role |
| `supabase/functions/verify-operator-key/index.ts` | Nouvelle edge function pour verifier une cle operateur |
| `supabase/functions/evaluate-permission/index.ts` | Supporter le contexte `operator_key_hash` pour resoudre le role |
| `supabase/functions/action-runner/index.ts` | Supporter le header `X-Operator-Key` |

## Resume du modele

```text
Organization (admin connecte)
  └── Agents
       ├── Tools (outils lies)
       ├── Actions (politique, quotas, environnements)
       └── Operateurs (nom + role + cle unique)
            └── Verification a la demande via la cle
```

