

## Plan: Bouton "Sélectionner / Désélectionner tout" sur la page Actions

### Contexte
L'utilisateur veut un bouton toggle au niveau des onglets "Endpoints" / "Actions" (en haut à droite de la `TabsList`) pour activer ou désactiver toutes les actions d'un coup.

### Changements dans `src/pages/Actions.tsx`

1. **Wrapper la `TabsList`** dans un `div flex justify-between items-center` pour placer le bouton à droite au même niveau.

2. **Ajouter un bouton "Select All / Deselect All"** qui :
   - Sur l'onglet **actions** : toggle `is_enabled` sur toutes les actions (bulk update dans `action_templates`).
   - Sur l'onglet **endpoints** : pas de sens (les endpoints ne sont pas activables), donc le bouton ne s'affiche que quand `activeTab === "actions"` et qu'il y a des actions.
   - Label dynamique : "Enable All" si au moins une action est désactivée, "Disable All" si toutes sont activées.

3. **Fonction `handleToggleAllActions`** :
   - Détermine si on active ou désactive tout (`allEnabled = actions.every(a => a.is_enabled)`).
   - Fait un `supabase.from("action_templates").update({ is_enabled: !allEnabled }).eq("project_id", currentProject.id)`.
   - Met à jour le state local `setActions(...)`.
   - Affiche un toast de confirmation.

### Rendu visuel (ligne ~646)
```tsx
<div className="flex items-center justify-between">
  <TabsList>
    <TabsTrigger value="endpoints">Endpoints ({endpoints.length})</TabsTrigger>
    <TabsTrigger value="actions">Actions ({actions.length})</TabsTrigger>
  </TabsList>
  {activeTab === "actions" && actions.length > 0 && (
    <Button variant="outline" size="sm" onClick={handleToggleAllActions}>
      {allEnabled ? "Disable All" : "Enable All"}
    </Button>
  )}
</div>
```

