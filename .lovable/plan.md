

# Corriger l'erreur 404 lors de l'appel action-runner depuis execute-plan

## Probleme

La fonction `execute-plan` appelle `action-runner` via HTTP interne, mais il manque le header `apikey` obligatoire pour que la passerelle Supabase puisse router la requete vers la bonne fonction. Sans ce header, la passerelle repond "404 page not found" au lieu de transmettre la requete.

## Cause technique

Dans `supabase/functions/execute-plan/index.ts` (lignes 348-354), l'appel a `action-runner` n'inclut que `Authorization` et `Content-Type`, mais pas `apikey` :

```text
const response = await fetch(actionRunnerUrl, {
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authHeader}`,
    // <-- il manque apikey !
  },
```

## Solution

Ajouter le header `apikey` dans l'appel interne. On utilisera `SUPABASE_SERVICE_ROLE_KEY` (deja disponible dans la fonction) ou `SUPABASE_ANON_KEY`.

## Fichier modifie

**`supabase/functions/execute-plan/index.ts`** (lignes 348-354)

Ajouter le header `apikey` avec la valeur de la variable d'environnement `SUPABASE_ANON_KEY` (ou a defaut, la service role key) dans les headers du `fetch` vers `action-runner` :

```text
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey;

const response = await fetch(actionRunnerUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authHeader}`,
    "apikey": anonKey,
  },
  body: JSON.stringify({ ... }),
});
```

Aucune autre modification n'est necessaire. Le redeploiement automatique de la fonction corrigera l'erreur 404.

