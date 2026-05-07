## Objectif
Fiabiliser l’envoi Slack depuis le simulateur pour que `create_chatpostmessage` exécute réellement `chat.postMessage` avec les bons champs attendus par Slack.

## Constats vérifiés
- L’action `create_chatpostmessage` existe bien sur l’endpoint `POST /chat.postMessage`.
- Son `input_schema` est vide et ses `constraints` ne contiennent aucun `body_template`.
- Le simulateur montre aujourd’hui un preview du type `{ channel: "general", message: "Hello world" }`.
- En exécution réelle, sans transformation, Slack reçoit `message` au lieu de `text` et renvoie donc `error: "no_text"`.
- Le précédent `not_in_channel` prouve qu’à un moment le champ texte passait bien ; le bug restant est donc la normalisation des inputs, pas le token lui-même.

## Plan
### 1. Corriger la normalisation des payloads Slack
- Ajouter une règle explicite pour les endpoints Slack de messaging, en particulier `/chat.postMessage`.
- Transformer automatiquement les aliases métier vers le format Slack attendu :
  - `message` -> `text`
  - conserver `text` s’il est déjà fourni
  - garder `channel` tel quel, puis le normaliser si besoin
- Faire cette transformation côté moteur d’exécution pour qu’elle s’applique même si le plan IA propose `message` au lieu de `text`.

### 2. Sécuriser aussi la génération d’actions Slack
- Enrichir l’action `create_chatpostmessage` avec un `input_schema` clair pour guider le planificateur :
  - `channel: string`
  - `text: string`
  - éventuellement accepter `message` comme alias côté UX
- Ajouter un `body_template` dédié pour Slack afin que le payload final soit toujours cohérent, indépendamment du wording généré par l’IA.

### 3. Gérer le nom de canal humain vs identifiant Slack
- Ajouter une résolution côté exécution pour convertir un nom convivial comme `général`, `general` ou `#general` vers un canal Slack réel.
- Si nécessaire, appeler `conversations.list` puis matcher par nom avant `chat.postMessage`.
- Si aucun canal n’est trouvé, renvoyer une erreur claire du type : `Canal Slack introuvable: general` au lieu d’une erreur opaque.

### 4. Améliorer le simulateur pour éviter les faux positifs
- Dans le preview, afficher le payload réel qui sera envoyé après transformation, pas seulement les inputs bruts du plan.
- Exemple attendu dans le simulateur :
```text
{
  "channel": "C123..." ou "general",
  "text": "Hello world"
}
```
- Cela évite qu’un preview paraisse correct alors que le payload live ne l’est pas.

### 5. Vérification
- Tester un dry-run sur un message simple vers `general`.
- Tester une exécution réelle de `create_chatpostmessage`.
- Vérifier qu’on n’obtient plus `no_text`.
- Vérifier que, si le canal public existe, l’erreur `not_in_channel` ne revient pas sur la connexion Slack utilisée.

## Détails techniques
- Fichier principal à corriger : `supabase/functions/action-runner/index.ts`
- Donnée à mettre à jour : enregistrement `action_templates` de `create_chatpostmessage` pour ajouter `input_schema` + `constraints.body_template`
- Amélioration UX possible : affichage du payload transformé dans `src/pages/Simulator.tsx`

## Résultat attendu
Quand tu demandes “envoie Hello world dans général”, le système doit produire puis envoyer un vrai payload Slack compatible, avec `text` renseigné et un canal résolu correctement.