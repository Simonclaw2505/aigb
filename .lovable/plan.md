## Objectif

Quand une action nécessite une approbation humaine, l'utilisateur qui clique sur **Approve** ou **Reject** doit **prouver son identité** en saisissant sa clé opérateur (`aig_op_…`). Sans clé valide avec un rôle autorisé (`owner`/`admin`), l'approbation est refusée — même si la session web appartient à un admin.

Aujourd'hui, le bouton "Approve" est visible dès que `userRole` (rôle org de la session) est admin, et l'enregistrement se fait sans aucune vérification de clé. Ça ne reflète pas le modèle de gouvernance par opérateur.

## Changements

### 1. Nouveau dialog : `ApproveWithOperatorKeyDialog`
Fichier : `src/components/simulator/ApproveWithOperatorKeyDialog.tsx`

- S'inspire de `ConfirmActionDialog` (champ clé + bouton "Vérifier", appel à `verify-operator-key`).
- Deux modes : `approve` ou `reject`. Affiche le contexte de l'étape (nom action, description, impact).
- Ne valide la clé que si `role ∈ ["owner", "admin"]` (ou rôles fournis par la policy). Sinon erreur : « Cette clé n'a pas le rôle requis pour approuver ».
- Sur succès, retourne `{ operator_id, operator_name, role }` au parent.

### 2. Brancher le dialog dans `ApprovalRequestPanel.tsx`

- Ajouter prop `agentId: string` (= `selectedProjectId`).
- Les boutons "Approve" / "Reject" n'appellent plus directement `onApprove/onReject` mais ouvrent le dialog avec le mode correspondant.
- Quand le dialog confirme, on appelle `onApprove(operatorInfo)` / `onReject(operatorInfo)` (signatures étendues).

### 3. `useApprovalRequests.ts` — tracer l'opérateur

- `approveRequest(stepNumber, userId, operatorInfo?)` : ajouter `operator_id`, `operator_name`, `role` dans l'objet `newApproval` poussé dans `approval_requests.approvals`.
- Idem pour `rejectRequest` dans `rejections`.
- Le rôle org de l'utilisateur connecté n'est plus suffisant : on stocke la clé opérateur ayant validé, pour audit.

### 4. `Simulator.tsx`

- Passer `agentId={selectedProjectId}` à `<ApprovalRequestPanel/>`.
- Adapter `handleApproveStep` / `handleRejectStep` pour transmettre l'`operatorInfo` reçu.
- Retirer la condition `isAdmin` qui masquait les boutons (n'importe quel membre peut **tenter** d'approuver, c'est la clé opérateur qui décide). Garder un message si aucun admin n'est connecté pour rappeler qu'il faut une clé `admin`/`owner`.

### 5. Mettre l'exigence en évidence (UX)

Dans le panneau "Approbation requise" :
- Sous-titre : « L'approbateur doit fournir sa clé opérateur (`aig_op_…`) avec rôle Admin/Owner. »
- Icône `KeyRound` à côté des boutons Approve/Reject.

## Fichiers modifiés

- `src/components/simulator/ApproveWithOperatorKeyDialog.tsx` (nouveau)
- `src/components/simulator/ApprovalRequestPanel.tsx`
- `src/hooks/useApprovalRequests.ts`
- `src/pages/Simulator.tsx`

Pas de migration DB : la colonne `approval_requests.approvals` est déjà `jsonb`.

## Hors scope (à confirmer si tu veux l'ajouter)

- Vérification côté backend que l'`operator_id` stocké correspond bien à un rôle approbateur au moment de `execute-plan` (défense en profondeur). Actuellement, `execute-plan` se base seulement sur le statut `approved` de la ligne.
