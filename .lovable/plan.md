

## Diagnostic

Il y a **deux** entrées `create_send` dans `action_templates` pour ce projet :
- `de43e017...` (policy: allow)
- `9be381b7...` (policy: require_confirmation)

Le code utilise `.maybeSingle()` pour résoudre le nom → UUID. Quand il y a des doublons, `maybeSingle()` retourne une **erreur** (pas de data), donc `resolvedTemplateId` reste la string `"create_send"`, et la requête `agent_capabilities` ne matche rien.

## Plan de correction

### 1. Corriger la résolution nom → UUID (doublon-safe)

Dans `supabase/functions/mcp-server/index.ts`, remplacer `.maybeSingle()` par `.limit(1).single()` ou mieux, utiliser `.limit(1)` et prendre le premier résultat :

```ts
// Ligne ~235-241 : remplacer maybeSingle par limit(1)
const { data: tpls } = await supabase
  .from("action_templates")
  .select("id")
  .eq("project_id", projectId)
  .eq("name", toolName)
  .eq("is_enabled", true)
  .eq("status", "active")
  .limit(1);
if (tpls && tpls.length > 0) resolvedTemplateId = tpls[0].id;
```

### 2. Nettoyer le doublon en base

Supprimer l'action_template dupliquée (`de43e017...` ou `9be381b7...`) et son entrée `agent_capabilities` correspondante, pour éviter toute ambiguïté future. On gardera celle qui a la policy `require_confirmation` (`9be381b7...`) puisque c'est celle configurée dans les capabilities avec la bonne policy.

Migration SQL :
```sql
-- Supprimer la capability orpheline
DELETE FROM agent_capabilities WHERE action_template_id = 'de43e017-e953-408e-b0cb-28d7421002cf';
-- Supprimer le doublon action_template
DELETE FROM action_templates WHERE id = 'de43e017-e953-408e-b0cb-28d7421002cf';
```

### Fichiers modifiés
- `supabase/functions/mcp-server/index.ts` — fix `.maybeSingle()` → `.limit(1)`
- Migration SQL — suppression du doublon `create_send`

