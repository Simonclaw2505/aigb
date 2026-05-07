## Objectif
Faire en sorte que `/simulator` exécute vraiment Slack en mode live, au lieu de renvoyer un succès simulé trompeur.

## Diagnostic confirmé
J’ai identifié le bug précis : les actions Slack utilisées par l’agent actif existent bien, mais elles sont **orphelines**.

Constats relevés :
- l’agent actif dans le simulateur est **AgentCom** (`89429418-...`)
- les actions utilisées par le plan (`get_conversationslist`, `create_chatpostmessage`, `get_usersinfo`) sont bien dans **AgentCom**
- mais ces `action_templates` ont tous `endpoint_id = null`
- `action-runner` dépend de `action.endpoint` pour retrouver `api_source_id` puis le connecteur
- le log backend confirme exactement : **`Action "get_conversationslist" has no linked endpoint — will run in simulated mode`**

Donc le problème n’est pas Slack lui-même :
le simulateur passe bien en `mode: "execute"`, mais l’exécution réelle retombe en simulation car les actions Slack ne sont pas reliées à leurs endpoints.

## Plan de correction

### 1. Réparer les données cassées de l’agent actuel
Appliquer une correction backend pour rattacher les actions Slack orphelines d’**AgentCom** aux bons endpoints Slack déjà présents dans l’organisation, en matchant au minimum sur :
- `project_id`
- `endpoint_method`
- `endpoint_path`
- l’outil Slack lié à l’agent via `agent_tools`

Résultat attendu :
- `create_chatpostmessage` pointe vers `/chat.postMessage`
- `get_conversationslist` pointe vers `/conversations.list`
- `get_usersinfo` pointe vers `/users.info`
- `action-runner` retrouve enfin le connecteur Slack réel

### 2. Corriger durablement le flux “Bibliothèque -> Import -> Actions”
Le bug vient aussi du parcours produit : aujourd’hui on peut se retrouver avec un outil Slack lié à l’agent, mais des actions créées sans `endpoint_id`.

Je vais sécuriser ce flux en ajoutant une vraie étape dédiée quand on arrive de la bibliothèque Slack dans `/import` :
- validation du token via `auth.test` uniquement, comme demandé pour le POC
- affichage des scopes détectés
- confirmation des endpoints à importer
- création/réutilisation propre de l’outil Slack pour l’agent actif
- proposition immédiate de générer les actions à partir des endpoints importés

Objectif : empêcher qu’une action Slack soit créée sans lien fort avec un endpoint.

### 3. Corriger le comportement de `/simulator` en mode live
Même si les données sont mal configurées, `/simulator` ne doit **jamais** afficher un “success simulated” en mode live.

Je vais modifier l’exécution pour que :
- le fallback simulé reste autorisé uniquement en **dry-run / preview**
- en **execute/live**, une action sans endpoint ou sans connecteur retourne un **échec explicite**
- le message d’erreur explique clairement la vraie cause : action non reliée / outil non configuré

Résultat attendu : plus de faux positifs. Soit ça envoie vraiment sur Slack, soit l’UI explique précisément pourquoi non.

### 4. Ajouter un garde-fou côté génération d’actions
Je vais aussi empêcher la création d’actions “orphelines” lors des générations automatiques :
- si on génère depuis un endpoint, `endpoint_id` sera obligatoire
- si une action existe déjà sans `endpoint_id` mais avec un `method/path` correspondant, on la réparera ou on bloquera la duplication silencieuse

### 5. Vérification de bout en bout
Après correctif, je validerai le scénario réel suivant :
- requête dans `/simulator`
- plan généré avec `get_conversationslist` puis `create_chatpostmessage`
- exécution live
- confirmation que la réponse backend n’est plus `simulated: true`
- confirmation que Slack répond réellement, ou à défaut une vraie erreur Slack exploitable

## Détails techniques
- Fichier UI principal concerné : `src/pages/Import.tsx`
- Composant de découverte Slack : `src/components/import/SlackDiscovery.tsx`
- Création manuelle des outils/connecteurs : `src/components/import/ManualApiConfig.tsx`
- Génération/gestion des actions : `src/pages/Actions.tsx`
- Exécution live : `supabase/functions/execute-plan/index.ts`
- Fallback fautif actuel : `supabase/functions/action-runner/index.ts`

Backfill à faire sur la base :
- relier les `action_templates` Slack d’AgentCom aux `endpoints` Slack via `endpoint_method + endpoint_path`
- s’appuyer sur `agent_tools` pour choisir le bon outil Slack déjà lié à l’agent

## Effet utilisateur attendu après fix
Dans `/simulator`, quand tu envoies :
```json
{ "channel": "general", "text": "Salut depuis mon agent 👋" }
```
tu n’auras plus un faux `simulated: true` en succès :
- soit le message part vraiment sur Slack
- soit tu vois une vraie erreur de configuration ou de permission

Si tu valides, j’implémente directement ce correctif complet.