

# Corriger l'action create_send restante (9be381b7)

## Probleme

Le projet "envoie de mail" a **deux** actions `create_send`. On a corrige `de43e017` mais le simulateur utilise `9be381b7`, qui a toujours `endpoint_id = NULL` et tombe en mode simule.

| Action ID | endpoint_path | endpoint_id | Status |
|-----------|--------------|-------------|--------|
| de43e017 | /v3/mail/send | 9894fc5e (corrige) | OK |
| 9be381b7 | /v3/marketing/singlesends/{id}/send | NULL | Mode simule |

## Solution

Deux options :

**Option retenue** : Lier `9be381b7` au meme endpoint `/v3/mail/send` (`9894fc5e`) et lui ajouter le meme `body_template`. Cela garantit que quelle que soit l'action choisie par le simulateur, l'envoi fonctionne.

### Donnee a modifier (pas de fichier code)

```sql
UPDATE action_templates
SET endpoint_id = '9894fc5e-456a-40ff-8db9-ee09d30c3523',
    endpoint_path = '/v3/mail/send',
    constraints = jsonb_set(
      COALESCE(constraints, '{}'::jsonb),
      '{body_template}',
      '{"personalizations":[{"to":[{"email":"{{to}}"}],"subject":"{{subject}}"}],"from":{"email":"{{from}}"},"content":[{"type":"text/html","value":"{{html_content}}"}]}'::jsonb
    )
WHERE id = '9be381b7-5537-47cd-99d9-502fb55b10c3';
```

Aucun fichier de code a modifier. La correction est purement dans les donnees.
