
## Connecter le Simulateur aux vraies APIs

### Probleme

La fonction `execute-plan` contient une fonction `simulateExecution()` (lignes 507-560) qui retourne des donnees fictives (`mock-1`, `mock-2`, etc.) au lieu d'appeler les vraies APIs. Le composant `action-runner` existe deja et sait faire les vrais appels (authentification, retry, redaction), mais `execute-plan` ne l'utilise pas.

### Solution

Modifier `execute-plan` pour qu'en mode `execute`, il appelle la fonction `action-runner` au lieu de `simulateExecution()`.

### Fichier modifie

**`supabase/functions/execute-plan/index.ts`**

1. **Remplacer `simulateExecution()`** par un appel HTTP interne vers `action-runner` :
   - Construire la requete avec `action_template_id`, `inputs`, et le token d'authentification de l'utilisateur
   - L'URL cible sera `${SUPABASE_URL}/functions/v1/action-runner`
   - Passer le `Authorization` header du user pour que `action-runner` verifie les permissions

2. **Garder `simulateExecution()` comme fallback** si l'appel a `action-runner` echoue pour une raison d'infrastructure (optionnel, peut etre supprime)

3. **Mapper le resultat** de `action-runner` vers le format `StepResult` attendu par le simulateur

### Details techniques

Le bloc actuel (lignes 356-417) :
```text
// Simulate execution
const executionResult = await simulateExecution(action, step.inputs);
```

Sera remplace par un appel reel :
```text
const response = await fetch(
  `${supabaseUrl}/functions/v1/action-runner`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authHeader}`,
    },
    body: JSON.stringify({
      action_template_id: step.action_template_id,
      inputs: step.inputs,
      environment: "development",
      dry_run: false,
    }),
  }
);
const actionResult = await response.json();
```

Le resultat de `action-runner` contient deja `success`, `data`, `error`, `execution_id`, `retries_used`, etc. -- on mappe directement vers `StepResult`.

La fonction `simulateExecution()` sera supprimee car elle n'a plus d'utilite.

### Impact

- Le simulateur executera les vraies requetes API via les connecteurs configures (ex: Productive.io)
- Les resultats reels seront affiches dans l'interface
- Les execution_runs seront enregistres par `action-runner` (pas de double enregistrement -- on supprime l'insert dans `execute-plan` car `action-runner` le fait deja)
