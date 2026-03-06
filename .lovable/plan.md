

## Plan: Mettre à jour le widget Privyo

**Fichier**: `src/pages/Auth.tsx`

Remplacer dans le `useEffect` qui charge le widget Privyo :
- **URL du script** : `https://fa4be116-055d-4827-8894-b21b1fe97aaf.lovableproject.com/widget.js` → `https://privyo-consent-guardian.lovable.app/widget.js`
- **API key** : `pk_8a1aaabaac2049eb88fde2c2eb27e93b` → `pk_d271923744364026b00b518845cd2aea`

Tout le reste (mode inline, target, détection de consentement, fallbacks) reste identique.

