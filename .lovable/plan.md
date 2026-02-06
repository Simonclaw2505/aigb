

# Plan : Simulator interactif avec confirmation, Security PIN et approbations

## Objectif

Transformer le Simulator pour qu'il simule un vrai workflow d'agent IA où l'utilisateur peut :
1. **Confirmer** une action (quand policy = `require_confirmation`)
2. **Entrer son code PIN** (quand `requires_security_pin = true`)
3. **Demander une approbation** (quand policy = `require_approval`)
4. **Valider/Rejeter** les demandes d'approbation en attente

Actuellement, le Simulator affiche "Execution Blocked" et "Needs Approval" mais sans moyen d'interagir.

---

## Ce qui va changer

### 1. Nouveau flux dans le Simulator

```text
[Plan genere] 
     |
     v
[Dry-run Preview]
     |
     +-- Action avec "Needs Confirmation" ?
     |        |
     |        v
     |   [Dialog: "Confirmer cette action ?"]
     |        |-- Oui --> Continue
     |        |-- Non --> Annuler
     |
     +-- Action avec "Needs Security PIN" ?
     |        |
     |        v
     |   [Dialog: SecurityPinDialog]
     |        |-- PIN valide --> Continue
     |        |-- PIN invalide --> Bloquer
     |
     +-- Action avec "Needs Approval" ?
              |
              v
         [Bouton: "Demander Approbation"]
              |
              v
         [Creation approval_request en BDD]
              |
              v
         [Message: "En attente d'approbation par un admin"]
```

### 2. Nouveaux composants UI

| Composant | Description |
|-----------|-------------|
| `ConfirmActionDialog.tsx` | Dialog simple "Voulez-vous confirmer cette action ?" |
| `ApprovalRequestPanel.tsx` | Panneau affichant les demandes en attente + boutons Approuver/Rejeter |
| Modification `Simulator.tsx` | Integration des 3 dialogs + logique de gestion des etats |

### 3. Modifications backend (execute-plan)

La fonction edge doit :
- Accepter un nouveau parametre `confirmations: string[]` (liste des step_number confirmes)
- Accepter `security_pin_verified: boolean` 
- Verifier cote serveur que les confirmations/PIN sont valides avant execution

### 4. Structure de donnees des approbations

Table `approval_requests` (existe deja) :
```
id, organization_id, policy_id, resource_type, resource_id,
action_type, requested_by, status (pending/approved/rejected),
approvals: [{user_id, approved_at}], rejections: [...]
```

---

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `src/components/simulator/ConfirmActionDialog.tsx` | Nouveau - Dialog de confirmation simple |
| `src/components/simulator/ApprovalRequestPanel.tsx` | Nouveau - Gestion des demandes d'approbation |
| `src/pages/Simulator.tsx` | Modifier - Integration des dialogs et nouveau flux |
| `src/hooks/useApprovalRequests.ts` | Nouveau - Hook pour gerer les approval_requests |
| `supabase/functions/execute-plan/index.ts` | Modifier - Support confirmations + PIN verification |

---

## Details d'implementation

### UI du Simulator modifiee

Quand une action necessite une confirmation :
```
┌─────────────────────────────────────────────────────────┐
│  Step 1: add_pet                                        │
│  [Needs Confirmation]                                   │
│                                                         │
│  Cette action va creer un nouvel animal dans la base.  │
│                                                         │
│  [Confirmer l'action]  [Annuler]                       │
└─────────────────────────────────────────────────────────┘
```

Quand une action necessite un PIN :
```
┌─────────────────────────────────────────────────────────┐
│  Step 2: delete_all_pets                                │
│  [Needs Security PIN] [High Risk]                       │
│                                                         │
│  Cette action est critique et necessite votre code PIN │
│                                                         │
│  [Entrer mon PIN]                                       │
└─────────────────────────────────────────────────────────┘
```

Quand une action necessite une approbation :
```
┌─────────────────────────────────────────────────────────┐
│  Step 3: batch_update_prices                            │
│  [Pending Approval]                                     │
│                                                         │
│  Cette action necessite l'approbation d'un admin.      │
│                                                         │
│  [Demander l'approbation]                              │
│                                                         │
│  --- ou si deja demandee ---                            │
│                                                         │
│  En attente d'approbation (demandee il y a 5 min)       │
│  [Approuver] [Rejeter] (visible si admin)              │
└─────────────────────────────────────────────────────────┘
```

### Nouveau state dans Simulator.tsx

```typescript
interface SimulatorState {
  // Existant
  plan: ExecutionPlan | null;
  dryRunResult: ExecutionResult | null;
  
  // Nouveau
  confirmedSteps: Set<number>;      // Steps confirmes par l'utilisateur
  pinVerified: boolean;             // PIN verifie pour cette session
  approvalRequestId: string | null; // ID de la demande d'approbation creee
  approvalStatus: "none" | "pending" | "approved" | "rejected";
}
```

### Logique cote serveur

```typescript
// execute-plan/index.ts - nouveaux parametres
interface ExecuteRequest {
  // Existant
  session_id: string;
  project_id: string;
  mode: "dry_run" | "execute";
  steps: PlanStep[];
  approval_id?: string;
  
  // Nouveau
  confirmed_steps?: number[];      // Steps confirmes explicitement
  security_pin?: string;           // PIN pour verification serveur
}
```

Le serveur verifiera :
1. Si `require_confirmation` : le step doit etre dans `confirmed_steps`
2. Si `requires_security_pin` : verifier le PIN via la fonction DB
3. Si `require_approval` : verifier que `approval_id` existe et est "approved"

---

## Section technique : Verification du PIN cote serveur

```typescript
// Dans execute-plan/index.ts
if (capability?.requires_security_pin) {
  if (!body.security_pin) {
    return { 
      status: "failed", 
      error: "Security PIN required",
      requires_pin: true 
    };
  }
  
  // Verifier via la fonction DB
  const { data: isValid } = await supabase.rpc("verify_security_pin", {
    pin: body.security_pin,
    stored_hash: userPinHash
  });
  
  if (!isValid) {
    return { status: "failed", error: "Invalid security PIN" };
  }
}
```

---

## Sequence complete

```text
1. Utilisateur tape "Ajoute un animal Fido"
2. generate-plan retourne le plan avec add_pet
3. Simulator appelle execute-plan mode=dry_run
4. Resultat: requires_confirmation=true pour step 1
5. UI affiche bouton "Confirmer"
6. Utilisateur clique "Confirmer"
7. State: confirmedSteps.add(1)
8. Simulator rappelle execute-plan mode=execute + confirmed_steps=[1]
9. Backend verifie confirmation, execute, retourne succes
```

