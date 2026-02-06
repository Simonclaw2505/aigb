
# Correction : Export MCP échoue

## Problèmes identifiés

### 1. Erreur principale - UUID invalide
**Ligne 308** de `src/hooks/useExport.ts` :
```typescript
included_actions: tools.map((t) => t.name),
```

Le code envoie les **noms** des actions ("delete_user", "add_pet") mais la colonne `included_actions` est de type `uuid[]` et attend des **IDs**.

### 2. Projet automatiquement sélectionné
Le sélecteur de projet ne s'affiche que s'il y a plus d'un projet (ligne 170 de Export.tsx). Comme tu n'as qu'un seul projet "active", il est auto-sélectionné sans afficher le sélecteur.

## Solution

### Fichier 1 : `src/hooks/useExport.ts`

**Ligne 308** - Utiliser les IDs au lieu des noms :

```typescript
// Avant
included_actions: tools.map((t) => t.name),

// Après - utiliser les IDs des action_templates
included_actions: (actions || []).map((a) => a.id),
```

### Fichier 2 : `src/pages/Export.tsx`

**Ligne 83** - Inclure aussi les projets "draft" :

```typescript
// Avant
.eq("status", "active")

// Après
.in("status", ["draft", "active"])
```

**Lignes 169-189** - Toujours afficher le projet sélectionné :

```typescript
{/* Project info - always show current project */}
{projects.length > 0 && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">Project</CardTitle>
    </CardHeader>
    <CardContent>
      {projects.length > 1 ? (
        <select
          className="w-full p-2 border rounded-md bg-background"
          value={selectedProject || ""}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{projects[0].name}</span>
          <Badge variant="secondary">{selectedProject ? "selected" : ""}</Badge>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

## Résumé des corrections

| Problème | Cause | Correction |
|----------|-------|------------|
| Export échoue avec erreur UUID | `included_actions` reçoit des noms au lieu d'IDs | Utiliser `actions.map(a => a.id)` |
| Projet auto-sélectionné invisible | Sélecteur masqué si un seul projet | Toujours afficher le projet actif |
| Projets draft exclus | Filtre `.eq("status", "active")` | Utiliser `.in("status", ["draft", "active"])` |

## Comportement après correction

1. Tu arrives sur /export
2. Tu vois ton projet "petstore" affiché
3. Tu cliques "Generate New Version"
4. L'export est créé avec les bons UUIDs d'actions
5. Tu peux télécharger le fichier JSON/YAML
