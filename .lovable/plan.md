

# Corriger le mode simule des actions create_send du projet "envoie de mail"

## Probleme

Les actions `create_send` du projet "envoie de mail" n'ont pas de `endpoint_id` renseigne. Sans cette liaison, l'action-runner ne trouve pas de connecteur API et tombe en **mode simule** au lieu de faire le vrai appel SendGrid.

## Cause

Il y a 4 actions `create_send` dans la base :

```text
Projet "Logistic Agent" :
  - 271d13b1 -> endpoint /v3/marketing/singlesends/{id}/send (lie)
  - ee3ce280 -> endpoint /v3/mail/send (lie, avec body_template)

Projet "envoie de mail" :
  - 9be381b7 -> endpoint_id = NULL (simule)
  - de43e017 -> endpoint_id = NULL (simule)  <-- c'est celle qu'il faut corriger
```

L'endpoint `/v3/mail/send` (id `9894fc5e`) existe bien et est lie a l'api_source SendGrid qui a un connecteur actif. Il manque juste le lien.

## Solution

1. **Mettre a jour l'action `de43e017`** (create_send pour `/v3/mail/send` dans le projet "envoie de mail") pour ajouter le `endpoint_id` manquant vers `9894fc5e`.

2. **Ajouter le `body_template`** sur cette meme action pour transformer les inputs plats en structure SendGrid Mail Send API.

### Migration SQL

```sql
UPDATE action_templates
SET endpoint_id = '9894fc5e-456a-40ff-8db9-ee09d30c3523',
    constraints = jsonb_set(
      COALESCE(constraints, '{}'::jsonb),
      '{body_template}',
      '{"personalizations":[{"to":[{"email":"{{to}}"}],"subject":"{{subject}}"}],"from":{"email":"{{from}}"},"content":[{"type":"text/html","value":"{{html_content}}"}]}'::jsonb
    )
WHERE id = 'de43e017-e953-408e-b0cb-28d7421002cf';
```

Aucun fichier de code a modifier. La correction est purement dans les donnees.

