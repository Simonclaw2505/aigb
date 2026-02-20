
# Diagnostic et amelioration des erreurs du Simulateur

## Pourquoi "failed to fetch" ?

Le probleme vient de la chaine d'appels entre les fonctions backend :

1. **`execute-plan` appelle `action-runner` en interne** -- cet appel interne passe par le reseau et peut echouer pour plusieurs raisons (CORS entre fonctions, timeout, etc.)
2. **Resolution du connecteur** : si l'action n'a pas de `endpoint_id` valide, ou si le connecteur API associe n'est pas actif/configure, l'appel API reel ne se fait pas
3. **Messages d'erreur generiques** : les blocs `catch` des deux fonctions retournent "Internal server error" sans details, ce qui donne "failed to fetch" cote client sans aucune indication utile

## Plan d'amelioration

### 1. Enrichir les erreurs dans `execute-plan` (backend)

**Fichier** : `supabase/functions/execute-plan/index.ts`

- Dans le bloc catch de l'appel a `action-runner` (lignes 395-408), ajouter le status HTTP, le corps de la reponse, et le nom de l'action dans le message d'erreur
- Dans le catch global (lignes 446-453), retourner le message d'erreur reel au lieu de "Internal server error"
- Ajouter des details sur le contexte de chaque step echoue (connector manquant, endpoint invalide, etc.)

### 2. Enrichir les erreurs dans `action-runner` (backend)

**Fichier** : `supabase/functions/action-runner/index.ts`

- Quand aucun connecteur n'est trouve (ligne 470-478), ajouter un log explicite et inclure cette information dans la reponse
- Dans le catch global (lignes 711-747), retourner le vrai message d'erreur au lieu de "Internal server error" (les donnees sensibles sont deja expurgees)
- Ajouter un champ `debug_info` dans la reponse d'erreur avec :
  - L'etape de la pipeline qui a echoue (auth, validation, connector lookup, API call)
  - L'ID du connecteur utilise (ou "none")
  - L'URL tentee (redactee)

### 3. Ameliorer l'affichage des erreurs dans le Simulateur (frontend)

**Fichier** : `src/pages/Simulator.tsx`

- Modifier `handleGeneratePlan` pour afficher le `message` en plus de `error` quand ils sont differents
- Modifier `runDryRun` pour capturer et afficher le detail des erreurs par step
- Dans la section "Execution results" (lignes 842-884), ajouter un panneau d'erreur plus detaille avec :
  - Le nom de l'action qui a echoue
  - La raison precise (permission, connecteur absent, erreur API, etc.)
  - Un conseil d'action ("Verifiez que le connecteur API est configure et actif")

### 4. Gerer le cas "failed to fetch" reseau

**Fichier** : `src/pages/Simulator.tsx`

- Dans les trois appels `fetch` (generate-plan, dry-run, execute), differencier une erreur reseau (`TypeError: Failed to fetch`) d'une erreur serveur
- Afficher un message specifique pour les erreurs reseau : "Impossible de joindre le serveur. Verifiez votre connexion ou reessayez."

## Details techniques

Les modifications sont reparties sur 3 fichiers :

```text
supabase/functions/execute-plan/index.ts   -- erreurs detaillees dans les reponses
supabase/functions/action-runner/index.ts  -- champ debug_info + vrais messages d'erreur
src/pages/Simulator.tsx                    -- affichage enrichi des erreurs
```

Aucune modification de schema de base de donnees n'est necessaire.
