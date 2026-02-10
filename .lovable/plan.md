

## Ajouter le type d'authentification "Custom Header"

### Probleme

Le dropdown d'authentification ne propose que API Key, Bearer Token, Basic Auth, OAuth 2.0 et No Auth. Productive.io necessite un header personnalise (`X-Auth-Token`) sans prefix, ce qui ne correspond a aucune de ces options.

### Solution

Ajouter une option **"Custom Header"** (`custom_header`) dans la liste des types d'authentification.

### Fichier modifie

**`src/components/connectors/ConnectorsPanel.tsx`**

1. Ajouter une entree dans le tableau `authTypes` :
   ```text
   { value: "custom_header", label: "Custom Header", description: "Custom header name and value" }
   ```

2. Adapter la section Authentication du formulaire pour que `custom_header` affiche les champs **Header Name** et **API Key / Token** sans champ prefix.

**`supabase/functions/action-runner/index.ts`**

3. Verifier que le type `custom_header` est correctement gere dans la logique d'injection des headers : le header doit etre `{header_name}: {credential_value}` sans prefix.

### Pour Productive.io

Apres cette modification, tu pourras configurer :
- **Type** : Custom Header
- **Header Name** : `X-Auth-Token`
- **API Key / Token** : ta cle API Productive
