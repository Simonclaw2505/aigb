## Objectif

Rendre l'UI plus cohérente : réordonner les CTA du Dashboard ("Tester mon agent" avant "Connecter mon agent"), déplacer les blocs vers les bonnes zones (Configuration / Supervision) et harmoniser les éléments visuels récurrents.

---

## 1. Refonte du Dashboard (`src/pages/Dashboard.tsx`)

Actuellement le Dashboard contient tout dans une seule colonne checklist + activité récente. On le restructure en 3 zones miroir de la sidebar.

### Nouvelle structure

```text
[ Bandeau statut système ]
[ Bienvenue + bouton Nouvel Agent ]
[ Stats (3 cards) ]

┌─ Configuration ──────────────┐  ┌─ Supervision ────────────────┐
│ 1. Connecter une application │  │ • Tester mon agent  →        │
│ 2. Créer un agent            │  │ • Connecter mon agent IA →   │
│ 3. Définir les actions       │  │ • Activité récente (liste)   │
│ 4. Régler les permissions    │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
```

### Changements précis

- **Onboarding checklist (colonne gauche, "Configuration")** : conserve les étapes liées au setup (outil, agent, actions, permissions). On retire les étapes `apikey` et `connect` de la checklist car elles deviennent des CTA dédiés à droite.
- **Colonne droite ("Supervision")** : 
  1. **CTA "Tester mon agent"** (vers `/simulator`) — placé en premier car ordre logique : on teste avant de brancher en prod. Icône `TestTube`, accent primary.
  2. **CTA "Connecter mon agent IA"** (vers `/export`) — Icône `Download`. Affiche un mini-aperçu (badge "Endpoint MCP prêt" si `apiKeysCount > 0`, sinon "Créer une clé d'abord" → `/settings`).
  3. **Activité récente** (liste compacte 5 dernières entrées, lien "Voir tout" → `/audit-logs`).

- Les deux CTA Test/Connect sont des cards cliquables avec : titre, courte description, icône à droite, hover bg-muted/40.

### Détail technique

- État `apiKeysCount` toujours fetché (déjà présent) pour conditionner le CTA "Connecter".
- Suppression du `<Progress>` de la checklist redevient pertinent (4 étapes au lieu de 4 — on garde mais ajusté).
- Conserver `allDone` mais basé sur les 4 nouvelles étapes config.

---

## 2. Revue de cohérence GUI globale

### A. Sidebar (`AppSidebar.tsx`) — déjà bien structurée, micro-ajustements

- Réordonner `supervisionItems` pour mettre **"Tester mon agent" AVANT "Connecter un agent IA"** (cohérence avec dashboard).
- Renommer "Connecter un agent IA" → **"Connecter mon agent IA"** (cohérence singulier possessif comme "Mes agents IA").

### B. Headers de page — uniformisation

Vérifier que toutes les pages utilisent `DashboardLayout` avec `title` + `description` cohérents. Pages à vérifier rapidement : `Tools`, `Agents` (Projects), `Actions`, `Permissions`, `Simulator`, `Export`, `Security`, `AuditLogs`, `Settings`, `Billing`. Aucun changement de fond, juste alignement des titres en français orienté PME (ex: éviter "Projects", utiliser "Mes agents IA").

### C. Tokens visuels récurrents

- Bandeau "Système opérationnel" du Dashboard et "Système actif" de la sidebar : harmoniser la couleur (utiliser le token `success` partout au lieu du HSL hardcodé `hsl(152,60%,42%)` dans la sidebar).
- Boutons primaires : tous en `rounded-lg` (déjà majoritaire).
- Cards : toutes en `border-border/50` (déjà le standard du Dashboard).

### Fichiers modifiés

- `src/pages/Dashboard.tsx` — refonte structure 2 colonnes Configuration/Supervision
- `src/components/layout/AppSidebar.tsx` — réordonner supervision + harmoniser couleur statut + renommage

### Hors scope

- Pas de modification de logique métier ni de routes.
- Pas de refonte des pages enfants (Tools, Agents, etc.) au-delà d'un éventuel renommage de titre si incohérent.
- Pas de nouveaux composants partagés extraits — on garde le code inline dans Dashboard pour rester simple.
