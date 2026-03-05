

## Diagnostic : pourquoi "Tool not found or not permitted"

### Problème 1 — L'action `create_send` n'est PAS dans `agent_capabilities`

La clé API `mcpf_E5sy...` est liée au projet `7f3ac1d1` (Mail SendGrid). Mais ce projet n'a qu'**1 seule entrée** dans `agent_capabilities` (l'action `get_lists`). L'action `create_send` (id: `de43e017-...`) n'y figure pas.

Le serveur MCP filtre les outils via `agent_capabilities`. Pas d'entrée = pas de permission.

**Cause probable** : les actions ont été créées mais jamais ajoutées aux "capabilities" de l'agent. Il manque un mécanisme de synchronisation automatique.

### Problème 2 — Mauvais nom de colonne dans le code MCP

Le code `mcp-server` fait :
```ts
.select("action_template_id, agent_policy, ...")
.neq("agent_policy", "deny")
```
Mais la colonne dans `agent_capabilities` s'appelle **`policy`**, pas `agent_policy`. Le champ `agent_policy` existe sur `action_templates`, pas sur `agent_capabilities`. Cela provoque des résultats vides ou incorrects.

### Problème 3 — UUID vs nom d'action

Le curl envoie `"name": "create_send"` (le nom lisible). Mais le code fait :
```ts
.eq("action_template_id", toolName)  // compare un nom à un UUID
```
Et dans `tools/list`, le serveur retourne `tpl?.id` (le UUID) comme nom d'outil. Il y a une incohérence : soit on utilise le UUID partout, soit on supporte aussi le nom.

---

## Plan de corrections

### Fichier : `supabase/functions/mcp-server/index.ts`

**1. Corriger le nom de colonne** (`agent_policy` → `policy`) dans les deux requêtes `agent_capabilities` :

- `tools/list` (ligne ~199) : `.select("action_template_id, policy, action_templates(...)").neq("policy", "deny")`
- `tools/call` (ligne ~233) : `.select("policy, action_templates(...)") ` et vérifier `capability.policy` au lieu de `capability.agent_policy`

**2. Supporter la recherche par nom ET par UUID** dans `tools/call` :

Ajouter un fallback : si `toolName` n'est pas un UUID valide, chercher d'abord l'`action_template` par `name` + `project_id`, puis utiliser son `id` pour la requête `agent_capabilities`.

```ts
// Si toolName n'est pas un UUID, résoudre par nom
let resolvedTemplateId = toolName;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-/;
if (!uuidRegex.test(toolName)) {
  const { data: tpl } = await supabase
    .from("action_templates")
    .select("id")
    .eq("project_id", projectId)
    .eq("name", toolName)
    .maybeSingle();
  if (tpl) resolvedTemplateId = tpl.id;
}
```

**3. Synchroniser les capabilities manquantes** : Ajouter une migration ou un mécanisme pour que toutes les `action_templates` actives d'un projet aient une entrée correspondante dans `agent_capabilities`. Pour le fix immédiat, insérer les entrées manquantes via une migration SQL :

```sql
INSERT INTO agent_capabilities (project_id, action_template_id, policy, is_active)
SELECT at.project_id, at.id, at.agent_policy, true
FROM action_templates at
WHERE at.is_enabled = true
  AND at.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM agent_capabilities ac
    WHERE ac.project_id = at.project_id
      AND ac.action_template_id = at.id
  );
```

### Résumé des fichiers modifiés

- `supabase/functions/mcp-server/index.ts` — corriger colonne `policy`, ajouter résolution nom→UUID
- Migration SQL — synchroniser `agent_capabilities` avec les `action_templates` existantes

