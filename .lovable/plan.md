

## Probleme

La page Export affiche l'URL `get-mcp-export` — c'est un endpoint REST classique qui sert le manifeste JSON/YAML et nécessite un **JWT utilisateur**. Ce n'est **pas** un serveur MCP.

Pour connecter un agent GPT (ou tout client MCP), il faut l'URL du **serveur MCP JSON-RPC** : `.../functions/v1/mcp-server`.

## Plan

Ajouter une section "MCP Server URL" sur la page Export, en plus de l'endpoint API existant :

### 1. Ajouter un helper `getMcpServerEndpoint` dans `useExport.ts`

```ts
const getMcpServerEndpoint = useCallback(() => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${baseUrl}/functions/v1/mcp-server`;
}, []);
```

### 2. Ajouter une carte "MCP Server" dans `Export.tsx`

Juste après la carte "API Endpoint", ajouter une carte dédiée au serveur MCP avec :
- L'URL `mcp-server` en lecture seule (copiable)
- Un rappel : "Use this URL with GPT, Claude, Cursor or any MCP client. Authenticate with your API key (Settings > API Keys) via the `Authorization: Bearer` header."

### 3. Renommer les labels pour clarifier

- Carte existante : "API Endpoint (REST)" — pour télécharger le manifeste
- Nouvelle carte : "MCP Server (for AI agents)" — pour connecter un client MCP

**Fichiers modifiés** : `src/hooks/useExport.ts` (~4 lignes), `src/pages/Export.tsx` (~25 lignes).

