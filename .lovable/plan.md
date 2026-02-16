

# Lier les Agents aux Outils (bidirectionnel)

## Objectif

Permettre de gerer les liens agent-outil depuis les deux pages : voir et ajouter/retirer des outils depuis un agent, et voir et ajouter/retirer des agents depuis un outil.

## Aucune migration necessaire

La table `agent_tools` (agent_id, api_source_id) existe deja avec les bonnes politiques de securite.

---

## Page Agents (`Projects.tsx`)

### Afficher les outils lies sur chaque carte

- Sous le badge de statut et la date, ajouter une ligne avec les noms des outils lies (petits badges cliquables)
- Si aucun outil lie, afficher "Aucun outil"
- Charger les liens via `agent_tools` avec jointure sur `api_sources` pour chaque agent

### Bouton "Gerer les outils" sur chaque carte

- Ajouter une icone Wrench dans le menu dropdown (trois points) de chaque agent
- Au clic, ouvrir un **Dialog** "Outils de [nom agent]" contenant :
  - La liste des outils deja lies avec un bouton X pour retirer
  - Un select/combobox pour ajouter un outil parmi ceux de l'organisation non encore lies
  - Bouton "Ajouter" pour inserer dans `agent_tools`

### Chargement des donnees

- Apres le fetch des projets, faire un second fetch pour recuperer tous les `agent_tools` de l'organisation avec les noms des `api_sources`
- Stocker dans un state `agentToolsMap: Record<agentId, Tool[]>`

---

## Page Outils (`Tools.tsx`)

### Badge "X agents" cliquable

- Le badge existant `{tool.agent_count} agents` devient un bouton
- Au clic, ouvrir un **Popover** ou **Dialog** affichant :
  - La liste des agents lies (noms) avec un bouton X pour delier
  - Un select pour ajouter un agent parmi ceux de l'organisation non encore lies
  - Bouton "Ajouter" pour inserer dans `agent_tools`

### Chargement des noms d'agents

- Enrichir le fetch existant dans `fetchTools` pour recuperer aussi les noms des agents lies via `agent_tools` + jointure `projects`

---

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/pages/Projects.tsx` | Fetch agent_tools, afficher outils lies sur les cartes, dialog de gestion des outils par agent |
| `src/pages/Tools.tsx` | Badge agents cliquable, dialog/popover de gestion des agents par outil, enrichir fetchTools |

## Details techniques

### Requetes cles

Charger les outils d'un agent :
```text
supabase
  .from("agent_tools")
  .select("api_source_id, api_sources(id, name)")
  .eq("agent_id", agentId)
```

Charger les agents d'un outil :
```text
supabase
  .from("agent_tools")
  .select("agent_id, projects:agent_id(id, name)")
  .eq("api_source_id", toolId)
```

Ajouter un lien :
```text
supabase.from("agent_tools").insert({ agent_id, api_source_id })
```

Retirer un lien :
```text
supabase.from("agent_tools").delete()
  .eq("agent_id", agentId)
  .eq("api_source_id", toolId)
```

### Flux utilisateur

```text
Depuis /agents :
  1. L'utilisateur voit les outils lies sur chaque carte agent
  2. Menu "..." > "Gerer les outils" ouvre un dialog
  3. Il peut retirer un outil (bouton X) ou en ajouter (select + bouton)

Depuis /tools :
  1. L'utilisateur voit le badge "2 agents" sur chaque carte outil
  2. Clic sur le badge ouvre un dialog
  3. Il peut retirer un agent (bouton X) ou en ajouter (select + bouton)
```

