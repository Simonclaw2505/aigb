

# Suppression du PIN a 6 chiffres et unification avec les cles operateur

## Probleme

Le simulateur contient deux systemes de verification en parallele :
1. **PIN a 6 chiffres** (`SecurityPinDialog`) -- ancien systeme, demande un code que personne n'a configure
2. **Cle operateur** (`ConfirmActionDialog` avec verification via `verify-operator-key`) -- nouveau systeme, fonctionnel

Quand `evaluate-permission` retourne `requires_security_pin: true`, le simulateur ouvre le dialogue de PIN au lieu d'utiliser la cle operateur. C'est pourquoi vous voyez cette demande de PIN incomprehensible.

## Solution

Supprimer entierement le systeme de PIN et rediriger toutes les verifications de role vers le systeme de cles operateur existant.

## Modifications

### 1. `src/pages/Simulator.tsx`

- Supprimer l'import de `SecurityPinDialog`
- Supprimer les etats `pinDialogOpen`, `pinActionStep`, `pinVerifiedForSession`, `securityPin`
- Supprimer les fonctions `stepNeedsPin`, `getStepsNeedingPin`, `openPinDialog`, `handlePinVerify`
- Supprimer le composant `SecurityPinDialog` du rendu
- Traiter `requires_security_pin` de la meme facon que `requires_confirmation` : ouvrir le `ConfirmActionDialog` avec `requiresOperatorKey: true`
- Supprimer l'envoi de `security_pin` dans le body de `execute-plan`

### 2. `supabase/functions/evaluate-permission/index.ts`

- Remplacer `requires_security_pin: true` par `requires_confirmation: true` (avec un flag `requires_operator_key`)
- Ou simplement garder `requires_confirmation` qui declenche deja la verification par cle operateur dans le `ConfirmActionDialog`

### 3. Fichiers a supprimer (nettoyage)

- `src/components/security/SecurityPinDialog.tsx` -- plus utilise
- `src/components/security/SecurityPinSetup.tsx` -- plus utilise
- `src/hooks/useSecurityPin.ts` -- plus utilise
- `supabase/functions/verify-security-pin/index.ts` -- plus utilise

### 4. `src/pages/Security.tsx`

- Retirer la section de configuration du PIN si elle existe encore

## Resultat

Quand une action exige une verification de role, le simulateur affiche le `ConfirmActionDialog` avec le champ "Cle de verification" (qui appelle `verify-operator-key`). Plus aucune reference au PIN a 6 chiffres.

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `src/pages/Simulator.tsx` | Supprimer toute la logique PIN, unifier avec ConfirmActionDialog |
| `supabase/functions/evaluate-permission/index.ts` | Remplacer `requires_security_pin` par `requires_confirmation` |
| `src/components/security/SecurityPinDialog.tsx` | Supprimer |
| `src/components/security/SecurityPinSetup.tsx` | Supprimer |
| `src/hooks/useSecurityPin.ts` | Supprimer |
| `supabase/functions/verify-security-pin/index.ts` | Supprimer |
| `src/pages/Security.tsx` | Retirer la section PIN si presente |

