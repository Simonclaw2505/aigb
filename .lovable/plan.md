

# Corriger l'erreur "Impossible de joindre le serveur" dans le Simulateur

## Cause du probleme

Les trois appels `fetch` vers les fonctions backend dans `src/pages/Simulator.tsx` n'incluent pas le header `apikey`, qui est **obligatoire** pour que la passerelle Supabase accepte la requete. Sans ce header, la requete est rejetee au niveau reseau avant meme d'atteindre la fonction, ce qui provoque une `TypeError: Failed to fetch` dans le navigateur.

Le test direct depuis le serveur fonctionne (la fonction repond correctement avec une erreur 403 d'acces au projet), ce qui confirme que les fonctions sont deployees et operationnelles.

## Correction

**Fichier** : `src/pages/Simulator.tsx`

Ajouter le header `apikey` dans les trois appels `fetch` existants :

1. **Ligne ~243** (appel a `generate-plan`) : ajouter `apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
2. **Ligne ~291** (appel a `execute-plan` en mode dry_run) : meme ajout
3. **Ligne ~380** (appel a `execute-plan` en mode execute) : meme ajout

Exemple du changement pour chaque appel :

```text
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${session?.access_token}`,
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,   // <-- ajout
},
```

Aucune autre modification n'est necessaire. Les fonctions backend sont correctement deployees et fonctionnelles.
