

## Diagnostic

L'action `create_send` (id: `9be381b7`) du projet "envoie de mail" a `endpoint_id = null`. Le action-runner (ligne 534-536) tombe donc en mode simulé :

```
if (endpoint) { ... resolve connector via api_source_id ... }
else { console.warn("will run in simulated mode") }
```

Le connecteur SendGrid existe bien (id: `8f3cb993`, base_url: `https://api.sendgrid.com`, credential_secret_id: `b4a583dd`), mais il n'est jamais atteint car la chaîne de résolution est : `action_template.endpoint_id` → `endpoints.api_source_id` → `api_connectors.api_source_id`. Or il n'y a **aucune `api_source`** ni **aucun `endpoint`** dans ce projet.

## Plan de correction

### 1. Créer les données manquantes en base (migration SQL)

```sql
-- 1. Créer l'api_source SendGrid pour le projet "envoie de mail"
INSERT INTO api_sources (id, project_id, organization_id, name, description, source_type, status)
VALUES (
  gen_random_uuid(),  -- sera capturé ci-dessous
  '7f3ac1d1-9cff-441a-93a8-77c2ee485c3a',
  '5900fde1-fcc1-411f-8644-7d5f218edc7d',
  'SendGrid',
  'SendGrid Mail Send API',
  'openapi',
  'active'
);

-- 2. Créer l'endpoint /v3/mail/send
-- 3. Lier le connecteur existant à cette api_source
-- 4. Mettre à jour l'action_template avec l'endpoint_id
```

On enchaînera les 4 opérations dans une seule migration avec des CTEs pour capturer les IDs générés.

### 2. Aucune modification de code

Le action-runner et le mcp-server sont déjà corrects. Il suffit de relier les données en base.

### Fichiers modifiés
- Migration SQL uniquement (aucun fichier TypeScript modifié)

