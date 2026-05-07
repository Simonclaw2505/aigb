
## Plan : CriticalActionGuard + édition d'outils

### Partie 1 — `CriticalActionGuard` sur la page Permissions

**Pourquoi cette page ?** C'est l'endroit le plus sensible : cocher une case dans `UserPermissionsPanel` accorde à un rôle opérateur (member, viewer, etc.) le droit d'exécuter une action — y compris des actions classées `high` ou `critical` (DELETE, écritures, etc.). Aucune confirmation forte n'existe aujourd'hui : un simple clic suffit, ce qui est exactement le scénario décrit ("passer de read à read+write").

**Nouveau composant** : `src/components/security/CriticalActionGuard.tsx`
- Wrapper réutilisable autour de `ConfirmActionDialog` existant
- API simple :
  ```tsx
  <CriticalActionGuard
    trigger={<Checkbox ... />}
    actionName="Autoriser DELETE /users pour le rôle member"
    description="..."
    estimatedImpact="Tous les opérateurs 'member' pourront supprimer des utilisateurs"
    requiresOperatorKey={true}
    agentId={agentId}
    onConfirm={(operatorInfo) => togglePermission(...)}
  />
  ```
- Réutilise la vérif clé opérateur via `verify-operator-key` (déjà sécurisée)
- Logge dans `audit_logs` après confirmation : qui (operator), quoi (rôle + action), quand

**Intégration dans `UserPermissionsPanel.tsx`** :
- Quand on coche une action de risque `high` ou `critical` → ouvre `CriticalActionGuard` avant `togglePermission`
- Quand on décoche n'importe quelle action déjà autorisée de risque ≥ `medium` → idem (révocation = critique aussi)
- Risque `read_only` / `low` → toggle direct sans friction

**Logging audit** :
```ts
await supabase.from("audit_logs").insert({
  organization_id, user_id, resource_type: "permission_rule",
  resource_id: actionId, action: checked ? "grant" : "revoke",
  metadata: { role, action_name, risk_level, operator_id, operator_name }
});
```

---

### Partie 2 — Éditer les outils existants dans `/tools` (onglet "Mes outils")

**Problème** : aujourd'hui, dans "Mes outils", on ne peut que supprimer. Impossible d'ajouter un endpoint à un outil existant après création.

**Solution** : nouveau composant `src/components/tools/EditToolDialog.tsx`
- Bouton crayon ✏️ sur chaque carte d'outil (à côté de la corbeille)
- Dialog avec :
  - **Infos générales** : nom, description (update sur `api_sources`)
  - **Endpoints** : liste des endpoints existants depuis la table `endpoints`, avec :
    - Suppression individuelle (delete row)
    - Ajout d'un nouveau (méthode + path + nom + description) → insert dans `endpoints` avec `api_source_id` du tool
  - Réutilise le pattern UI de `ToolLibraryForm` (méthode + path inline, badge couleur par méthode)
- Recharge `fetchTools()` à la fermeture pour mettre à jour le compteur d'endpoints

**Modifications** :
- `src/pages/Tools.tsx` : ajouter état `editingToolId`, bouton crayon, render `<EditToolDialog>`
- Nouveau fichier `EditToolDialog.tsx`

---

### Détails techniques

**RLS** :
- `endpoints` : insert/delete OK pour `member`+ via policy existante (`Members can manage endpoints`)
- `api_sources` : update OK pour `member`+ via policy existante
- `audit_logs` : insert OK pour tout authentifié
- Aucune migration nécessaire

**Fichiers créés** :
- `src/components/security/CriticalActionGuard.tsx`
- `src/components/tools/EditToolDialog.tsx`

**Fichiers modifiés** :
- `src/components/permissions/UserPermissionsPanel.tsx` (wrap toggle + audit log)
- `src/pages/Tools.tsx` (bouton edit + dialog)

**Hors scope** (à confirmer si tu veux) :
- Étendre `CriticalActionGuard` à d'autres pages (ex: rotation de clés API, suppression d'agent, changement de rôle org)
- Édition des paramètres de connecteur (auth, secret) dans `EditToolDialog` — pour l'instant je couvre seulement nom/desc/endpoints
