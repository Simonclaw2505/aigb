
# Plan de Securite Renforcee pour MCP Foundry

## Resume des demandes

| # | Demande | Etat actuel |
|---|---------|-------------|
| 1 | Nombre d'appels sans validation + taille batch | Rate limit heure/jour existe, mais pas de compteur "libre" avant validation ni limite batch |
| 2 | Code PIN unique par admin (pas second facteur global) | Non implemente |
| 3 | Soft delete avec periode de recuperation | Les DELETE sont immediats et permanents |
| 4 | Quota journalier pour actions critiques/irreversibles | Non implemente |
| 5 | Option 2 admins pour valider | Existe `requires_approval` mais toujours 1 seul approbateur |
| 6 | Sandbox obligatoire avant production | Non implemente |

---

## Architecture proposee

```text
+---------------------+
|   Agent/Utilisateur |
+---------------------+
          |
          v
+---------------------+     +---------------------+
| evaluate-permission |---->| Checks effectues    |
+---------------------+     +---------------------+
          |                 | 1. Agent capability |
          |                 | 2. Rate limit h/j   |
          |                 | 3. Quota critique   |
          |                 | 4. Multi-approbation|
          v                 +---------------------+
+---------------------+
|   action-runner     |
+---------------------+
          |
          v
+---------------------+     +---------------------+
|   Checks executes   |---->| 5. Batch size limit |
+---------------------+     | 6. PIN verification |
                            | 7. Sandbox check    |
                            +---------------------+
          |
          v
+---------------------+
| API externe ou      |
| soft-delete si DEL  |
+---------------------+
```

---

## 1. Appels libres avant validation + limite batch

### Concept
Chaque action definit :
- `free_executions_before_approval` : nombre d'appels que l'agent peut faire sans demander de validation
- `max_batch_size` : nombre max d'elements qu'une mutation peut affecter en une fois

### Modifications base de donnees

```sql
-- Table agent_capabilities : ajout colonnes
ALTER TABLE agent_capabilities 
ADD COLUMN free_executions INTEGER DEFAULT NULL,
ADD COLUMN max_batch_size INTEGER DEFAULT NULL;

-- Table action_templates : ajout dans constraints JSON
-- Deja supporte via le champ JSONB "constraints"
```

### Modifications code

| Fichier | Changement |
|---------|------------|
| `ActionBuilderForm.tsx` | Ajouter champs "Free executions before approval" et "Max batch size" dans l'onglet Constraints |
| `action-runner/index.ts` | Verifier `max_batch_size` : si l'input contient un tableau, verifier sa taille |
| `evaluate-permission/index.ts` | Compter les executions recentes et comparer a `free_executions` |
| `AgentCapabilitiesPanel.tsx` | Ajouter les nouveaux champs dans le formulaire |

---

## 2. Code PIN unique par admin

### Concept
Chaque admin de l'organisation peut definir son propre code PIN a 6 chiffres. Pour les actions marquees `requires_security_pin = true`, l'admin doit entrer son PIN avant que l'action soit approuvee.

### Nouvelle table

```sql
CREATE TABLE admin_security_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- RLS : chaque admin ne peut voir/modifier que son propre PIN
ALTER TABLE admin_security_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own PIN"
ON admin_security_pins FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Modifications

| Fichier | Changement |
|---------|------------|
| `agent_capabilities` table | Ajouter `requires_security_pin BOOLEAN DEFAULT false` |
| Page Settings | Nouvelle section "Security PIN" pour definir/modifier son PIN personnel |
| `SecurityPinDialog.tsx` (nouveau) | Popup pour saisir le PIN lors d'une approbation |
| `verify-security-pin/index.ts` (nouvelle edge function) | Verifier le hash du PIN cote serveur |
| `AgentCapabilitiesPanel.tsx` | Ajouter toggle "Requires Security PIN" |

---

## 3. Soft delete avec periode de recuperation

### Concept
Au lieu de supprimer immediatement, marquer les enregistrements comme "deleted" avec une date d'expiration. Une fonction CRON purge les donnees apres X jours.

### Nouvelle table

```sql
CREATE TABLE soft_deleted_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  original_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  deleted_data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES auth.users(id),
  is_permanently_deleted BOOLEAN DEFAULT false
);

-- Index pour accelerer les recherches
CREATE INDEX idx_soft_deleted_expires ON soft_deleted_records(expires_at) 
WHERE is_permanently_deleted = false;

-- RLS
ALTER TABLE soft_deleted_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage soft deleted records"
ON soft_deleted_records FOR ALL
USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));
```

### Periode de retention configurable

```sql
ALTER TABLE organizations ADD COLUMN soft_delete_retention_days INTEGER DEFAULT 30;
```

### Modifications code

| Fichier | Changement |
|---------|------------|
| `action-runner/index.ts` | Pour les DELETE sur tables supportees, inserer dans `soft_deleted_records` au lieu de supprimer |
| Page Settings | Section "Data Retention" pour configurer la duree de retention |
| Nouvelle page `RecycleBin.tsx` | Interface pour voir et restaurer les elements supprimes |
| Edge function `cleanup-expired/index.ts` | CRON job pour purger les enregistrements expires |

---

## 4. Quota journalier pour actions critiques/irreversibles

### Concept
Limiter le nombre total d'executions d'actions `risky_write` et `irreversible` par jour au niveau du projet.

### Modifications base de donnees

```sql
ALTER TABLE projects 
ADD COLUMN daily_critical_quota INTEGER DEFAULT 100,
ADD COLUMN daily_critical_count INTEGER DEFAULT 0,
ADD COLUMN quota_reset_at TIMESTAMPTZ DEFAULT now();

-- Fonction pour reset quotidien
CREATE OR REPLACE FUNCTION reset_daily_quotas()
RETURNS void AS $$
BEGIN
  UPDATE projects 
  SET daily_critical_count = 0, 
      quota_reset_at = now()
  WHERE quota_reset_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Modifications code

| Fichier | Changement |
|---------|------------|
| `action-runner/index.ts` | Avant execution d'une action critique, verifier et incrementer le compteur |
| `evaluate-permission/index.ts` | Verifier que le quota n'est pas atteint |
| Page Settings/Project | Slider pour configurer le quota journalier critique |

---

## 5. Option multi-approbation (2 admins)

### Modifications base de donnees

```sql
ALTER TABLE agent_capabilities 
ADD COLUMN required_approvals INTEGER DEFAULT 1 CHECK (required_approvals BETWEEN 1 AND 3);
```

### Logique existante utilisee
La table `approval_requests` a deja un champ `approvals JSONB` qui stocke un tableau d'approbations. Il suffit de verifier que `array_length(approvals) >= required_approvals` et que tous les `user_id` sont distincts.

### Modifications code

| Fichier | Changement |
|---------|------------|
| `AgentCapabilitiesPanel.tsx` | Ajouter select "Required approvals: 1 / 2" |
| `evaluate-permission/index.ts` | Retourner `pending_approvals_needed: X` dans la reponse |
| `action-runner/index.ts` | Verifier que le nombre d'approbations distinctes est suffisant |

---

## 6. Sandbox obligatoire avant production

### Concept
Une action ne peut etre executee en production que si elle a ete executee avec succes au moins une fois en development ou staging.

### Modifications base de donnees

```sql
ALTER TABLE agent_capabilities 
ADD COLUMN require_sandbox_first BOOLEAN DEFAULT false;
```

### Logique

```sql
-- Verifier si l'action a deja ete executee en dev/staging avec succes
SELECT EXISTS (
  SELECT 1 FROM execution_runs
  WHERE action_template_id = $1
    AND environment IN ('development', 'staging')
    AND status = 'success'
) AS has_sandbox_run;
```

### Modifications code

| Fichier | Changement |
|---------|------------|
| `action-runner/index.ts` | Si `environment = production` et `require_sandbox_first = true`, verifier l'historique |
| `AgentCapabilitiesPanel.tsx` | Ajouter toggle "Require sandbox test before production" |

---

## Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `src/components/security/SecurityPinDialog.tsx` | Dialog pour saisir le PIN |
| `src/components/security/SecurityPinSetup.tsx` | Interface pour definir son PIN |
| `src/hooks/useSecurityPin.ts` | Hook pour gerer le PIN |
| `src/pages/RecycleBin.tsx` | Page pour gerer les elements soft-deleted |
| `supabase/functions/verify-security-pin/index.ts` | Verification serveur du PIN |
| `supabase/functions/cleanup-expired/index.ts` | CRON pour purger les soft deletes expires |

---

## Fichiers a modifier

| Fichier | Modifications principales |
|---------|--------------------------|
| `src/components/actions/ActionBuilderForm.tsx` | Champs free_executions, max_batch_size |
| `src/components/permissions/AgentCapabilitiesPanel.tsx` | Tous les nouveaux champs agent capabilities |
| `supabase/functions/action-runner/index.ts` | Batch size, quota critique, soft delete, sandbox check |
| `supabase/functions/evaluate-permission/index.ts` | Free executions, multi-approval count |
| `src/pages/Settings.tsx` | Sections PIN et retention |

---

## Ordre d'implementation recommande

| Priorite | Fonctionnalite | Complexite | Impact |
|----------|----------------|------------|--------|
| 1 | Max batch size | Faible | Critique - empeche les mutations massives |
| 2 | Quota journalier critique | Faible | Eleve - limite les degats potentiels |
| 3 | Multi-approbation | Moyenne | Eleve - principe des 4 yeux |
| 4 | Code PIN par admin | Moyenne | Eleve - authentification forte |
| 5 | Soft delete | Moyenne | Eleve - recuperation possible |
| 6 | Free executions counter | Moyenne | Moyen - flexibilite |
| 7 | Sandbox obligatoire | Faible | Moyen - qualite |

---

## Migrations SQL completes

```sql
-- Migration 1: Nouvelles colonnes agent_capabilities
ALTER TABLE agent_capabilities 
ADD COLUMN IF NOT EXISTS free_executions INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_batch_size INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS required_approvals INTEGER DEFAULT 1 CHECK (required_approvals BETWEEN 1 AND 3),
ADD COLUMN IF NOT EXISTS requires_security_pin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_sandbox_first BOOLEAN DEFAULT false;

-- Migration 2: Table admin_security_pins
CREATE TABLE IF NOT EXISTS admin_security_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE admin_security_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own PIN"
ON admin_security_pins FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Migration 3: Table soft_deleted_records
CREATE TABLE IF NOT EXISTS soft_deleted_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  original_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  deleted_data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES auth.users(id),
  is_permanently_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_soft_deleted_expires 
ON soft_deleted_records(expires_at) 
WHERE is_permanently_deleted = false;

ALTER TABLE soft_deleted_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage soft deleted records"
ON soft_deleted_records FOR ALL
USING (get_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- Migration 4: Colonnes projets pour quota
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS daily_critical_quota INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS daily_critical_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quota_reset_at TIMESTAMPTZ DEFAULT now();

-- Migration 5: Retention soft delete configurable
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS soft_delete_retention_days INTEGER DEFAULT 30;
```

---

## Interface utilisateur finale

### Dans l'onglet Constraints d'une action :
- Nouveau champ "Max items per mutation" (max_batch_size)

### Dans Agent Capabilities :
- Nouveau champ "Free executions before approval" (0 = toujours demander)
- Nouveau champ "Max batch size" (items par appel)
- Nouveau select "Required approvals: 1 / 2 / 3"
- Nouveau toggle "Require Security PIN"
- Nouveau toggle "Require sandbox test first"

### Dans Settings > Security :
- Section "Your Security PIN" (definir/modifier)
- Section "Data Retention" (duree avant purge definitive)
- Section "Daily Critical Quota" (limite par projet)

### Nouvelle page Recycle Bin :
- Liste des elements supprimes avec date d'expiration
- Boutons "Restore" et "Delete permanently"
