
# ✅ DONE: Traiter "rejected" comme état terminal

## Problème résolu

Les étapes rejetées bloquaient l'exécution car la logique ne les considérait pas comme un état terminal.

## Changements effectués

### 1. `src/pages/Simulator.tsx`
- `getStepsNeedingApproval()` ne bloque plus que sur `pending` ou absence de demande
- Ajout de `getSkippedSteps()` pour identifier les étapes rejetées
- `handleExecute()` envoie maintenant `skipped_steps` au backend

### 2. `supabase/functions/execute-plan/index.ts`
- Interface `ExecuteRequest` accepte `skipped_steps?: number[]`
- Les étapes skippées retournent `status: "skipped"` sans exécution

## Comportement

1. Approuver/rejeter toutes les étapes
2. Bouton **Execute** devient actif
3. Exécution : étapes approuvées = succès, étapes rejetées = skipped
