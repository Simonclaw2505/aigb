

## Diagnostic : action-runner retourne 401

Le mcp-server appelle action-runner via fetch (ligne 270) avec seulement `Authorization: Bearer <SERVICE_ROLE_KEY>`. Mais la passerelle Edge Functions exige aussi le header **`apikey`** pour router la requête. Sans ce header, elle rejette avec 401.

C'est documenté dans la mémoire du projet : *"Toutes les requêtes vers les Edge Functions doivent inclure le header 'apikey'"*.

## Correction

### Fichier : `supabase/functions/mcp-server/index.ts`

Ajouter le header `apikey` dans l'appel fetch vers action-runner (ligne ~272) :

```ts
// Forward to action-runner
const runnerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/action-runner`;
const runnerResp = await fetch(runnerUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,   // <-- ajout
    "x-mcp-server-call": "true",
  },
  body: JSON.stringify({ action_template_id: resolvedTemplateId, input_parameters: toolArgs }),
});
```

Un seul fichier modifié, une seule ligne ajoutée.

