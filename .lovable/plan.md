
# Plan : Corriger l'erreur RLS et implémenter le flux d'onboarding

## Problème identifié
L'import échoue car :
1. **Aucune organisation** n'existe pour l'utilisateur connecté
2. **Aucun projet** n'existe dans la base de données
3. Le code utilise un `project_id` fictif (`00000000-0000-0000-0000-000000000000`) qui n'existe pas
4. Les politiques de sécurité (RLS) vérifient que l'utilisateur appartient à l'organisation du projet

## Solution proposée

### Étape 1 : Créer un hook de gestion du projet actif
Créer `src/hooks/useCurrentProject.ts` qui :
- Récupère les projets de l'utilisateur
- Gère la sélection du projet actif
- Crée automatiquement une organisation et un projet par défaut si l'utilisateur n'en a pas

### Étape 2 : Créer un composant d'onboarding
Créer `src/components/onboarding/ProjectSetup.tsx` qui :
- Détecte si l'utilisateur n'a pas d'organisation/projet
- Propose un formulaire simple pour créer son premier projet
- Crée l'organisation et le projet en une seule action

### Étape 3 : Mettre à jour la page Import
Modifier `src/pages/Import.tsx` pour :
- Utiliser le vrai `project_id` depuis le hook
- Afficher l'onboarding si aucun projet n'existe
- Bloquer l'import tant que l'utilisateur n'a pas de projet

### Étape 4 : Mettre à jour la page Projects
Modifier `src/pages/Projects.tsx` pour :
- Récupérer les vrais projets depuis la base
- Implémenter la création de projet avec création d'organisation si nécessaire

---

## Détails techniques

### Nouveau hook : useCurrentProject
```text
src/hooks/useCurrentProject.ts
├── Récupère l'organisation de l'utilisateur
├── Récupère les projets de l'organisation
├── Gère le projet actif (localStorage + state)
├── Fonction createDefaultProject() :
│   ├── Crée une organisation si absente
│   ├── Ajoute l'utilisateur comme owner
│   └── Crée un projet "Mon Premier Projet"
└── Retourne { currentProject, projects, isLoading, createDefaultProject }
```

### Flux de données
```text
Utilisateur connecté
       │
       ▼
┌──────────────────┐
│ useCurrentProject│
└────────┬─────────┘
         │
    A-t-il une org?
         │
    ┌────┴────┐
    Non      Oui
    │         │
    ▼         ▼
Afficher   A-t-il un projet?
Onboarding    │
    │    ┌────┴────┐
    │    Non      Oui
    │    │         │
    │    ▼         ▼
    └──► Afficher  Afficher
         Onboarding Import normal
```

### Modifications de fichiers

| Fichier | Action |
|---------|--------|
| `src/hooks/useCurrentProject.ts` | Créer (nouveau) |
| `src/components/onboarding/ProjectSetup.tsx` | Créer (nouveau) |
| `src/pages/Import.tsx` | Modifier (utiliser vrai project_id) |
| `src/pages/Projects.tsx` | Modifier (implémenter CRUD) |
| `src/pages/Dashboard.tsx` | Modifier (afficher onboarding si pas de projet) |
