

# Bibliotheque d'outils -- version base de donnees

## Objectif

Creer une table `tool_library` en base de donnees pour stocker le catalogue d'APIs pre-configurees (Salesforce, HubSpot, Pipedrive, QuickBooks, Xero, Pennylane et futures). Les admins pourront ajouter, modifier et supprimer des entrees. Les utilisateurs pourront parcourir la bibliotheque et utiliser un outil pour pre-remplir le formulaire d'import.

## Architecture

### Nouvelle table : `tool_library`

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant unique |
| name | text NOT NULL | Nom de l'API (ex: "Salesforce") |
| slug | text UNIQUE NOT NULL | Identifiant URL (ex: "salesforce") |
| description | text | Description courte |
| category | text NOT NULL | Categorie (ex: "CRM", "Comptabilite") |
| logo_url | text | URL du logo (optionnel) |
| base_url | text NOT NULL | URL de base de l'API |
| auth_type | text NOT NULL DEFAULT 'bearer' | Type d'auth (bearer, api_key, custom, none) |
| auth_header_name | text DEFAULT 'Authorization' | Nom du header d'auth |
| auth_instructions | text | Instructions pour obtenir la cle |
| extra_headers | jsonb DEFAULT '{}' | Headers supplementaires (ex: Xero-tenant-id) |
| endpoints | jsonb DEFAULT '[]' | Liste des endpoints pre-configures |
| is_published | boolean DEFAULT true | Visible dans la bibliotheque |
| created_by | uuid | Utilisateur ayant cree l'entree |
| created_at | timestamptz DEFAULT now() | Date de creation |
| updated_at | timestamptz DEFAULT now() | Date de mise a jour |

### Politiques RLS

- **SELECT** : Tout utilisateur authentifie peut lire les entrees publiees (`is_published = true`)
- **INSERT / UPDATE / DELETE** : Reserve aux utilisateurs avec un role (les admins de la plateforme). Pour commencer, on autorise tout utilisateur authentifie a gerer la bibliotheque (on peut restreindre plus tard avec un role "platform_admin").

### Donnees initiales

Inserer les 6 outils via la migration :
- Salesforce (CRM, OAuth Bearer, 6 endpoints)
- HubSpot (CRM, Bearer Token, 5 endpoints)
- Pipedrive (CRM, Custom x-api-token, 5 endpoints)
- QuickBooks Online (Comptabilite, OAuth Bearer, 4 endpoints)
- Xero (Comptabilite, OAuth Bearer + Xero-tenant-id, 4 endpoints)
- Pennylane (Comptabilite, Bearer Token, 4 endpoints)

Le format `endpoints` en JSON :
```text
[
  {"method": "GET", "path": "/sobjects", "name": "Liste des objets", "description": "..."},
  ...
]
```

## Fichiers a creer / modifier

### 1. Migration SQL

Creer la table `tool_library` avec les colonnes ci-dessus, les politiques RLS, le trigger `update_updated_at_column`, et les 6 entrees initiales.

### 2. Nouveau composant : `src/components/tools/ToolLibrary.tsx`

- Fetche les entrees de `tool_library` ou `is_published = true`
- Grille de cartes avec : nom, categorie (badge), description, nombre d'endpoints, type d'auth
- Barre de recherche + filtre par categorie
- Bouton "Utiliser" sur chaque carte -> redirige vers `/import?library={slug}`
- Bouton "Ajouter a la bibliotheque" pour les admins -> ouvre un dialog de creation

### 3. Nouveau composant : `src/components/tools/ToolLibraryForm.tsx`

Dialog/formulaire pour creer ou modifier une entree de la bibliotheque :
- Champs : name, slug (auto-genere depuis le nom), description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints (editeur JSON simplifie)
- Utilise pour l'ajout et l'edition

### 4. Modification : `src/pages/Tools.tsx`

Ajouter des onglets (Tabs) :
- "Mes outils" : la grille actuelle
- "Bibliotheque" : le nouveau composant `ToolLibrary`

### 5. Modification : `src/pages/Import.tsx`

Lire le parametre `?library={slug}` depuis l'URL. Si present :
- Fetcher l'entree correspondante dans `tool_library`
- Passer en mode "Configuration manuelle"
- Pre-remplir `ManualApiConfig` avec les donnees

### 6. Modification : `src/components/import/ManualApiConfig.tsx`

Ajouter des props optionnelles pour le pre-remplissage :
- `initialName`, `initialBaseUrl`, `initialDescription`, `initialAuthType`, `initialAuthHeaderName`, `initialExtraHeaders`, `initialEndpoints`
- Initialiser les `useState` avec ces valeurs au montage

## Flux utilisateur

```text
Page Outils -> Onglet "Bibliotheque"
  -> Recherche "HubSpot"
  -> Clic "Utiliser"
  -> /import?library=hubspot
  -> Formulaire pre-rempli (nom, URL, auth, 5 endpoints)
  -> L'utilisateur entre son token
  -> Sauvegarde -> api_sources + endpoints + connector crees
```

```text
Page Outils -> Onglet "Bibliotheque"
  -> Clic "Ajouter a la bibliotheque"
  -> Dialog formulaire
  -> Remplir les champs + endpoints
  -> Sauvegarder -> nouvelle entree dans tool_library
```

## Details techniques

- La table `tool_library` est **globale** (pas liee a une organisation). Tous les utilisateurs voient le meme catalogue.
- Le champ `endpoints` est un JSON array stocke en `jsonb`, ce qui permet d'ajouter/supprimer des endpoints sans table de jointure.
- Le champ `slug` est UNIQUE pour permettre les liens `/import?library={slug}`.
- Le `updated_at` est gere par le trigger existant `update_updated_at_column`.
- Aucune donnee sensible n'est stockee dans la bibliotheque (pas de tokens, pas de cles). Les credentials sont entres par l'utilisateur au moment de la configuration.

