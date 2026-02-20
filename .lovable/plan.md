

# Reactiver le bouton "Se connecter"

Retirer l'etat desactive du bouton "Se connecter" sur la page d'accueil pour le rendre a nouveau cliquable.

## Modification

**Fichier** : `src/pages/Landing.tsx`

- Retirer l'attribut `disabled` du bouton
- Restaurer les classes de style normales (`text-white/80 hover:text-white hover:bg-white/10`)
- Remettre le `onClick` avec la navigation vers `/auth`

