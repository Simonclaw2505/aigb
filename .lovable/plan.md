

## Problème

Le `privyoLoaded.ref` est mis à `true` dès le premier chargement du widget. Quand l'onglet "signup" est réaffiché (navigation React ou même refresh partiel), le `useEffect` fait `if (privyoLoaded.current) return` et **ne recharge jamais le widget**. Résultat : le conteneur `#privyo-consent` est vide, `gdprConsent` reste `false`, le bouton reste bloqué.

De plus, `activeTab` démarre à `"signin"` — donc au refresh, l'utilisateur doit d'abord cliquer sur "Créer un compte" pour déclencher le `useEffect`, mais le ref bloque.

## Plan de correction

**Fichier : `src/pages/Auth.tsx`**

1. **Supprimer `privyoLoaded` ref** — ne plus empêcher le rechargement du widget
2. **Vider le conteneur `#privyo-consent`** au début du `useEffect` (avant d'injecter le script) pour éviter les doublons : `target.innerHTML = ""`
3. **Ajouter un cleanup** dans le `useEffect` qui nettoie le conteneur quand on quitte l'onglet signup
4. **Garder les fallbacks existants** (onload check, onerror, MutationObserver, timeout 4s)

Cela garantit que chaque fois qu'on arrive sur l'onglet signup (y compris après refresh), le widget est rechargé proprement.

