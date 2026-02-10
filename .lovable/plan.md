

# Systeme d'API Keys pour Agents + Export OpenAI-Ready

## Contexte

Aujourd'hui, le `action-runner` n'accepte que des tokens utilisateur (login/mot de passe). Un agent IA ne peut pas s'authentifier. De plus, l'export MCP genere un manifeste brut, mais pas un fichier directement utilisable comme "tools" dans OpenAI ou Claude.

Ce plan ajoute deux fonctionnalites majeures :
1. Un systeme d'API keys dediees aux agents
2. Un export au format OpenAI `tools/functions` pret a l'emploi

---

## Vue d'ensemble

```text
+------------------+       +-------------------+       +------------------+
|  Settings >      |       |   Export Page      |       |  action-runner   |
|  API Keys Tab    |       |   + OpenAI format  |       |  + API key auth  |
|                  |       |                    |       |                  |
| - Creer une cle  |       | - Download OpenAI  |       | - Verifie Bearer |
| - Revoquer       |       |   tools JSON       |       |   OU API key     |
| - Copier         |       | - Instructions     |       | - Meme securite  |
| - Voir usage     |       |   d'integration    |       |                  |
+------------------+       +-------------------+       +------------------+
```

---

## Partie 1 : Table `agent_api_keys`

Nouvelle table en base de donnees :

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | Identifiant |
| project_id | uuid (FK) | Projet lie |
| organization_id | uuid (FK) | Organisation |
| name | text | Nom descriptif ("Agent Compta") |
| key_hash | text | Hash SHA-256 de la cle (on ne stocke jamais la cle en clair) |
| key_prefix | text | Les 8 premiers caracteres pour identification (ex: "mcpf_a1b2") |
| permissions | jsonb | Permissions optionnelles (actions autorisees, environnements) |
| rate_limit_per_hour | integer | Limite par heure (optionnel) |
| expires_at | timestamptz | Date d'expiration (optionnel) |
| last_used_at | timestamptz | Dernier usage |
| usage_count | integer | Nombre total d'appels |
| is_active | boolean | Active/revoquee |
| created_by | uuid | Utilisateur createur |
| created_at | timestamptz | Date de creation |

**RLS** : Seuls les admins/owners de l'organisation peuvent creer, voir et gerer les cles. Les cles sont hashees -- jamais stockees en clair.

**Format de cle** : `mcpf_` + 48 caracteres aleatoires (ex: `mcpf_a1b2c3d4e5f6...`). La cle complete n'est montree qu'une seule fois a la creation.

---

## Partie 2 : Interface API Keys dans Settings

Dans l'onglet "API Keys" de la page Settings (qui est actuellement vide) :

- **Bouton "Create API Key"** : ouvre un dialog avec :
  - Nom de la cle (ex: "Agent Compta Production")
  - Projet associe (select)
  - Expiration optionnelle
  - Limite de rate optionnelle
- **Apres creation** : affiche la cle complete UNE SEULE FOIS avec un bouton Copier et un avertissement
- **Liste des cles** : tableau avec nom, prefixe, projet, statut, dernier usage, bouton revoquer
- **Revocation** : dialog de confirmation, desactive la cle immediatement

---

## Partie 3 : Authentification API Key dans `action-runner`

Modifier le `action-runner` pour accepter deux modes d'authentification :

1. **Mode existant** : Bearer token utilisateur (inchange)
2. **Nouveau mode** : Header `X-API-Key: mcpf_...`

Logique :
```text
1. Verifier si header X-API-Key present
2. Si oui : hasher la cle, chercher dans agent_api_keys
3. Verifier : is_active, not expired, project_id match
4. Mettre a jour last_used_at et usage_count
5. Executer l'action avec les memes controles de securite
6. Si non : fallback sur le Bearer token (comportement actuel)
```

L'agent authentifie par API key aura les memes controles de securite (permissions, rate limits, validation de schema, etc.).

---

## Partie 4 : Export format OpenAI

Ajouter sur la page Export un nouveau bouton **"Download OpenAI Tools"** qui genere un fichier JSON au format :

```text
{
  "instructions": "Vous etes un agent connecte a [Nom du projet]...",
  "server": {
    "base_url": "https://xxx.supabase.co/functions/v1/action-runner",
    "auth_header": "X-API-Key",
    "auth_value": "<VOTRE_API_KEY_ICI>"
  },
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "list_projects",
        "description": "List all projects",
        "parameters": {
          "type": "object",
          "properties": { ... },
          "required": [...]
        }
      }
    }
  ]
}
```

Ce fichier est directement copier-collable dans la configuration d'un assistant OpenAI, Claude, ou n'importe quel agent compatible function calling.

---

## Partie 5 : Section "Integration Guide" sur la page Export

Ajouter une carte avec des instructions pas-a-pas :

1. Creer une API key dans Settings
2. Telecharger l'export OpenAI
3. Remplacer `<VOTRE_API_KEY_ICI>` par la cle
4. Coller les `tools` dans la configuration de l'agent
5. L'agent appelle `action-runner` avec les bons parametres

Avec un snippet de code Python/JS montrant comment appeler l'endpoint.

---

## Details techniques

### Fichiers crees
- `src/hooks/useAgentApiKeys.ts` -- hook CRUD pour les API keys
- `src/components/settings/AgentApiKeysPanel.tsx` -- interface de gestion des cles
- `src/components/settings/CreateApiKeyDialog.tsx` -- dialog de creation
- `src/components/export/OpenAIExportCard.tsx` -- carte export OpenAI
- `src/components/export/IntegrationGuide.tsx` -- guide d'integration

### Fichiers modifies
- `supabase/functions/action-runner/index.ts` -- ajout authentification API key
- `src/pages/Settings.tsx` -- remplacement du contenu de l'onglet API Keys
- `src/pages/Export.tsx` -- ajout de la carte OpenAI et du guide
- `src/hooks/useExport.ts` -- ajout fonction `generateOpenAIExport`
- `supabase/functions/_shared/cors.ts` -- ajout du header `X-API-Key` dans ALLOWED_HEADERS

### Migration SQL
- Creation de la table `agent_api_keys`
- Politiques RLS (admins: ALL, members: SELECT)
- Index sur `key_hash` pour les lookups rapides

