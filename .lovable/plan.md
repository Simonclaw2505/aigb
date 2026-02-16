

# Audit de securite OWASP Top 10 -- AIGB / MCP Foundry

## Etat actuel : ce qui est deja bien fait

L'application a deja un socle de securite solide :
- **CORS strict** avec allowlist (pas de `*` en production)
- **RLS (Row-Level Security)** sur toutes les tables avec des politiques granulaires
- **Protection SSRF** sur `test-api-connection` (blocklist d'IP privees)
- **Chiffrement AES-GCM** des secrets en base
- **HMAC-SHA256** pour les appels internes entre fonctions
- **Redaction automatique** des donnees sensibles dans les logs d'execution
- **Rate limiting** sur les actions d'agents
- **Security PIN** avec verification server-side pour les actions a haut risque
- **Sanitisation anti-injection de prompt** dans `generate-plan`
- **Audit logging** systematique

---

## Vulnerabilites identifiees par categorie OWASP

### A01 - Broken Access Control (CRITIQUE)

**Probleme 1 : `fetch-openapi-spec` sans authentification**
Cette edge function n'exige aucun JWT. N'importe qui peut l'utiliser comme proxy SSRF pour fetcher des URLs arbitraires (seul HTTPS est verifie, pas d'anti-SSRF comme dans `test-api-connection`).

**Correction :**
- Ajouter une verification JWT
- Ajouter la meme blocklist SSRF que `test-api-connection`

**Probleme 2 : Pas de verification `verify_jwt` dans `config.toml`**
Le fichier `config.toml` ne contient que le `project_id`. Aucune configuration `[functions.xxx]` avec `verify_jwt = false` n'est explicitement definie, ce qui signifie que le comportement par defaut s'applique. Il faut s'assurer que toutes les fonctions valident bien le JWT en code.

---

### A02 - Cryptographic Failures (MOYEN)

**Probleme : Fallback du secret de chiffrement**
Dans `secrets-manager`, si `SECRETS_ENCRYPTION_KEY` n'est pas configuree, le code utilise `SUPABASE_SERVICE_ROLE_KEY` comme cle de chiffrement. C'est dangereux car la cle de service change si le projet est recree.

**Correction :**
- Supprimer le fallback : si la cle n'existe pas, refuser toute operation (pas seulement un warning)

---

### A03 - Injection (FAIBLE a MOYEN)

**Probleme 1 : `dangerouslySetInnerHTML` dans `chart.tsx`**
Utilise pour injecter des styles CSS. Le contenu vient du code (THEMES), pas de l'utilisateur, donc le risque est faible. Mais c'est une mauvaise pratique.

**Probleme 2 : Pas de validation Zod sur les formulaires**
Les formulaires de login/signup n'utilisent pas de validation schema (Zod). Le mot de passe n'exige que `minLength={6}` cote HTML, facilement contournable.

**Correction :**
- Ajouter une validation Zod pour email, password (min 8 chars, complexite), fullName
- Ajouter une validation server-side des inputs dans les edge functions qui ne la font pas encore

---

### A04 - Insecure Design (MOYEN)

**Probleme 1 : Pas de protection brute-force sur le PIN**
Le endpoint `verify-security-pin` et la verification dans `execute-plan` n'implementent pas de lockout apres N tentatives echouees. Un attaquant peut tester les 1 million de combinaisons du PIN a 6 chiffres.

**Correction :**
- Ajouter un compteur d'echecs par utilisateur
- Bloquer apres 5 tentatives pendant 15 minutes
- Notifier l'admin apres 3 echecs

**Probleme 2 : Pas de limite de tentatives de connexion**
Le formulaire de login n'a aucun rate limiting cote client ni indication de lockout. (Supabase Auth a un rate limiting integre, mais il faut le completer cote UI)

---

### A05 - Security Misconfiguration (MOYEN)

**Probleme 1 : Messages d'erreur trop detailles**
Plusieurs edge functions renvoient `error.message` directement au client, ce qui peut exposer des details d'implementation (noms de tables, structure de requetes).

**Correction :**
- Renvoyer des messages generiques au client
- Logger les details uniquement cote serveur

**Probleme 2 : `console.error` excessif cote client**
13 fichiers contiennent des `console.error` qui peuvent exposer des details techniques dans la console du navigateur.

---

### A07 - Identification and Authentication Failures (MOYEN)

**Probleme 1 : Politique de mot de passe faible**
Seul `minLength={6}` est applique. Pas d'exigence de complexite (majuscules, chiffres, caracteres speciaux).

**Correction :**
- Exiger au minimum 8 caracteres avec validation de complexite via Zod
- Afficher un indicateur de force du mot de passe

**Probleme 2 : Pas de gestion d'expiration de session visible**
L'utilisateur n'est pas prevenu quand sa session expire. `autoRefreshToken: true` est configure mais aucun fallback UI n'existe en cas d'echec de refresh.

---

### A08 - Software and Data Integrity Failures (FAIBLE)

**Probleme : Pas de verification d'integrite sur les specs OpenAPI importees**
Les specs sont fetchees et parsees sans validation de signature ou de checksum. Un attaquant controlant un serveur OpenAPI pourrait injecter des definitions malicieuses.

**Correction :**
- Valider la structure de la spec apres parsing
- Limiter les tailles des champs individuels

---

### A09 - Security Logging and Monitoring Failures (FAIBLE)

L'audit logging est deja bien implemente. Ameliorations possibles :
- Ajouter le logging des tentatives de connexion echouees
- Ajouter des alertes sur les patterns suspects (ex: 10 echecs de PIN en 5 min)

---

## Plan d'implementation (par priorite)

### Phase 1 -- Critiques (a faire immediatement)

1. **Securiser `fetch-openapi-spec`**
   - Ajouter la verification JWT
   - Ajouter la blocklist SSRF (meme patterns que `test-api-connection`)

2. **Supprimer le fallback de cle de chiffrement**
   - Dans `secrets-manager`, retourner une erreur 503 si `SECRETS_ENCRYPTION_KEY` n'est pas configuree au lieu d'utiliser la cle de service

3. **Protection brute-force sur le PIN**
   - Creer une table `pin_attempt_logs` pour tracker les tentatives
   - Ajouter un lockout de 15 minutes apres 5 echecs dans `verify-security-pin` et `execute-plan`

### Phase 2 -- Important

4. **Validation Zod sur les formulaires auth**
   - Validation email + password (min 8 chars, 1 majuscule, 1 chiffre) + fullName (max 100 chars)

5. **Assainir les messages d'erreur**
   - Remplacer les `error.message` par des messages generiques dans toutes les edge functions
   - Garder les details dans les logs serveur uniquement

6. **Rate limiting visible sur le login**
   - Ajouter un compteur de tentatives cote client avec delai progressif

### Phase 3 -- Ameliorations

7. **Gestion d'expiration de session**
   - Ajouter un listener sur les erreurs 401 pour rediriger vers `/auth`
   - Afficher un toast avant expiration

8. **Nettoyage des `console.error`**
   - Remplacer par un logger conditionnel qui ne s'affiche qu'en dev

9. **Headers de securite HTTP**
   - Ajouter `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` dans les reponses des edge functions

### Details techniques

Les fichiers concernes par les modifications :

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/fetch-openapi-spec/index.ts` | Ajout auth JWT + blocklist SSRF |
| `supabase/functions/secrets-manager/index.ts` | Suppression fallback cle |
| `supabase/functions/verify-security-pin/index.ts` | Ajout protection brute-force |
| `supabase/functions/execute-plan/index.ts` | Ajout protection brute-force PIN |
| `src/pages/Auth.tsx` | Validation Zod + indicateur force mot de passe |
| `src/hooks/useAuth.tsx` | Gestion expiration session |
| Toutes les edge functions | Assainissement messages d'erreur + headers securite |
| Migration SQL | Table `pin_attempt_logs` |

