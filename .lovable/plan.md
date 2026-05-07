## Problème constaté
- Quand le plan affiche « Approval Required », cliquer « Execute Plan » exécute quand même l'action.
- L'alerte d'approbation est trop discrète et passe inaperçue.

## Cause racine
Dans `supabase/functions/execute-plan/index.ts`, le flag `requiresApproval` n'est positionné **que** si une `agent_capability` existe avec `policy = "require_approval"`. Or `generate-plan` lève le flag aussi quand `action.requires_approval = true` au niveau du template (sans capability). Résultat : côté exécution, aucun `capability` → `requiresApproval = false` → pas de blocage → l'action part directement, même si le plan a affiché « Approval Required ».

Côté UI, `getStepsNeedingApproval()` repose sur `result.permission_check.requires_approval`, qui vient d'execute-plan. Comme ce dernier ne le marque pas, `canExecuteNow()` renvoie `true` et le bouton « Execute » est actif.

## Plan de correction

### 1. Backend : bloquer réellement les actions à approbation
Fichier : `supabase/functions/execute-plan/index.ts`
- Considérer une action comme nécessitant approbation si **l'une** des conditions est vraie :
  - `capability.policy === "require_approval"`
  - `action.requires_approval === true` (flag du template)
  - `action.risk_level === "irreversible"` (sécurité par défaut)
- En mode `execute`, si `requiresApproval` est vrai et que `approved_steps` ne contient pas le step (et pas d'`approval_id` legacy), refuser : `allowed = false`, `denial_reason = "En attente d'approbation humaine"`.
- En mode `dry_run`, renvoyer `status: "pending_approval"` et `permission_check.requires_approval = true` pour que l'UI le reflète.

### 2. Frontend : rendre l'approbation requise très visible
Fichier : `src/pages/Simulator.tsx`
- Transformer l'alerte « Approval Required » en bandeau **destructive** en haut du plan (icône Shield + couleur warning forte, fond contrasté, titre gras « Approbation humaine requise »).
- Ajouter un badge rouge/orange « Pending approval » sur chaque step concerné dans la liste.
- Remplacer le bouton « Execute Plan » désactivé par un bouton clairement barré : « Bloqué — approbation requise » avec icône Lock.
- Ajouter un compteur visible : « 1 étape en attente d'approbation (0/1 approuvée) ».
- Faire défiler/scroller automatiquement vers le panneau d'approbation au moment du dry-run si `requires_approval`.

### 3. Composant `ApprovalRequestPanel`
Fichier : `src/components/simulator/ApprovalRequestPanel.tsx`
- Renforcer la bordure et le fond (warning/destructive selon état) pour qu'on ne le rate pas.
- Ajouter une icône Shield large + titre « Action bloquée tant que non approuvée ».

### 4. Vérification
- Sur une action marquée `requires_approval` au niveau template :
  - Le dry-run doit afficher le step en `pending_approval`.
  - Le bouton « Execute Plan » doit être désactivé.
  - Forcer un appel direct à `execute-plan` sans `approved_steps` doit retourner un step `failed` avec `denial_reason` clair, **sans** appeler l'API tierce (Slack).
- Après « Approve », l'exécution doit passer normalement.

## Détails techniques
- Fichiers modifiés :
  - `supabase/functions/execute-plan/index.ts` (logique d'évaluation)
  - `src/pages/Simulator.tsx` (UI bandeau, bouton, badges)
  - `src/components/simulator/ApprovalRequestPanel.tsx` (renforcement visuel)
- Aucune migration BDD nécessaire.
- Déploiement : redeploy de l'edge function `execute-plan`.
