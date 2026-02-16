

# Mise a jour SendGrid + Historique des tests

## 1. Mise a jour des endpoints SendGrid

Remplacer les 5 endpoints actuels par la liste complete fournie (environ 40 endpoints) dans la table `tool_library`, organises par categorie :

- **Mail Send** : POST /mail/send, GET /user/scheduled_sends, DELETE /user/scheduled_sends/{batch_id}
- **Marketing Listes** : GET/POST /marketing/lists, GET/DELETE/PATCH /marketing/lists/{list_id}
- **Marketing Contacts** : PUT/GET/DELETE /marketing/contacts, POST /marketing/lists/{list_id}/contacts
- **Campaigns (Single Sends)** : CRUD sur /marketing/singlesends + schedule + send
- **Templates** : CRUD sur /templates + versions
- **Stats** : /stats, /stats/global, /stats/mailbox_providers, /stats/devices
- **Email Activity** : GET /messages, GET /messages/{msg_id}
- **Domain & Sender Auth** : /whitelabel/domains, /verified_senders
- **Tracking Settings** : click, open, subscription
- **Webhooks** : /user/webhooks/event/settings

Tous les paths seront prefixes avec `/v3` (convention SendGrid).

Execution via une requete SQL `UPDATE` sur la ligne existante.

## 2. Historique des tests de connexion

Actuellement, le composant `ManualApiConfig` n'affiche qu'un seul resultat de test a la fois et ne conserve pas l'historique. Le probleme est particulierement genant pour les POST : on ne voit pas si l'appel a reellement fonctionne.

### Changements dans `ManualApiConfig.tsx`

- Remplacer `testResult: TestResult | null` par `testHistory: TestHistoryEntry[]` (un tableau)
- Chaque entree contient : timestamp, methode, path, resultat (status, body, erreur), duree
- A chaque test, ajouter l'entree en debut de tableau (les plus recents en haut)
- Afficher le panneau d'historique sous forme de liste deroulante (Collapsible ou ScrollArea)
- Chaque entree affiche :
  - Heure + methode + path
  - Badge succes/echec avec le status code
  - Le body de la reponse dans un bloc `<pre>` repliable
- Bouton "Effacer l'historique" pour repartir a zero

### Structure de donnees

```text
TestHistoryEntry {
  id: string
  timestamp: Date
  method: string
  path: string
  success: boolean
  status?: number
  statusText?: string
  body?: unknown
  error?: string
  durationMs: number
}
```

### Interface utilisateur

Le panneau d'historique sera affiche dans une Card dediee sous le bouton "Tester la connexion", avec :
- Titre "Historique des tests" + compteur
- Liste scrollable (max ~300px de hauteur)
- Chaque entree : badge methode colore + path + status + bouton pour voir la reponse
- Pour les POST/PUT/DELETE : indication claire "Action effectuee" ou "Echec" avec le detail de la reponse du serveur

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| Base de donnees (SQL) | UPDATE tool_library SET endpoints = [...] WHERE slug = 'sendgrid' |
| `src/components/import/ManualApiConfig.tsx` | Remplacement du state testResult par testHistory, ajout du panneau d'historique |

## Details techniques

- L'edge function `test-api-connection` ne change pas : elle retourne deja le body, le status et les headers. Le front-end ne les exploitait simplement pas assez.
- La mesure de duree sera faite cote client (avant/apres l'appel a la fonction).
- L'historique est en memoire uniquement (pas persiste en base), il se reinitialise a chaque rechargement de page.
