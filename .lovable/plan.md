
# Correction : Traiter "rejected" comme état terminal

## Problème

**Ligne 241** de `src/pages/Simulator.tsx` :
```typescript
!getApprovalForStep(r.step_number)?.status?.includes("approved")
```

Cette condition retourne `true` pour "rejected" car "rejected" ne contient pas "approved", donc les étapes rejetées bloquent l'exécution.

## Solution

Modifier la logique pour ne bloquer que sur les étapes `pending` ou sans demande.

## Fichiers à modifier

### 1. `src/pages/Simulator.tsx`

**Ligne 238-243** - Modifier `getStepsNeedingApproval()` :

```typescript
const getStepsNeedingApproval = (): number[] => {
  if (!dryRunResult) return [];
  return dryRunResult.results
    .filter((r) => {
      if (!r.permission_check?.requires_approval) return false;
      const approval = getApprovalForStep(r.step_number);
      // Seules les étapes pending ou sans demande bloquent
      // "approved" et "rejected" sont des états terminaux
      return !approval || approval.status === "pending";
    })
    .map((r) => r.step_number);
};
```

**Ajouter une nouvelle fonction** `getSkippedSteps()` :

```typescript
const getSkippedSteps = (): number[] => {
  if (!dryRunResult) return [];
  return dryRunResult.results
    .filter((r) => {
      const approval = getApprovalForStep(r.step_number);
      return approval?.status === "rejected";
    })
    .map((r) => r.step_number);
};
```

**Modifier `handleExecute()`** pour envoyer les étapes à ignorer au backend :

```typescript
body: JSON.stringify({
  session_id: plan.session_id,
  project_id: selectedProjectId,
  mode: "execute",
  steps: plan.steps,
  confirmed_steps: Array.from(confirmedSteps),
  security_pin: securityPin,
  skipped_steps: getSkippedSteps(), // Nouveau
})
```

### 2. `supabase/functions/execute-plan/index.ts`

**Ajouter `skipped_steps` à l'interface** :

```typescript
interface ExecuteRequest {
  session_id: string;
  project_id: string;
  mode: "dry_run" | "execute";
  steps: PlanStep[];
  approval_id?: string;
  confirmed_steps?: number[];
  security_pin?: string;
  skipped_steps?: number[]; // Nouveau
}
```

**Gérer les étapes skippées dans la boucle** (avant le traitement normal) :

```typescript
for (const step of steps) {
  // Skip les étapes rejetées
  if (skipped_steps?.includes(step.step_number)) {
    results.push({
      step_number: step.step_number,
      action_name: step.action_name,
      status: "skipped",
      result: { reason: "Rejected during approval workflow" },
      permission_check: {
        allowed: false,
        requires_confirmation: false,
        requires_approval: true,
        requires_security_pin: false,
        denial_reason: "Action rejected by administrator",
      },
    });
    continue; // Passer à l'étape suivante
  }
  
  // ... reste du traitement existant
}
```

## Résumé

| Changement | Effet |
|------------|-------|
| Fix `getStepsNeedingApproval()` | "rejected" ne bloque plus le bouton Execute |
| Ajouter `getSkippedSteps()` | Identifie les étapes à ignorer |
| Envoyer `skipped_steps` au backend | Le serveur sait quelles étapes ignorer |
| Gérer le skip côté serveur | Les étapes rejetées retournent status "skipped" |

## Comportement après correction

1. Tu approuves 5 actions, tu en rejettes 3
2. Toutes ont un statut terminal (approved ou rejected)
3. `getStepsNeedingApproval()` retourne `[]`
4. Bouton **Execute** devient actif
5. Exécution : 5 succès + 3 skipped
