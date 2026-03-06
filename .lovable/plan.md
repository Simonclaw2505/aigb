

## Remplacer la checkbox GDPR par le widget Privyo inline

### Changements

**`src/pages/Auth.tsx`** (lignes 266-276) :
- Supprimer le `<Checkbox>` et son `<Label>` GDPR
- Les remplacer par un `<div id="privyo-consent"></div>` qui servira de cible au widget Privyo
- Ajouter un `useEffect` qui injecte dynamiquement le script Privyo avec les attributs `data-mode="inline"` et `data-target="#privyo-consent"` quand le composant signup est monté
- Retirer l'import de `Checkbox` s'il n'est plus utilisé ailleurs
- Garder la validation `gdprConsent` côté state mais la lier au widget Privyo via un `MutationObserver` ou event listener sur le DOM pour détecter quand l'utilisateur a donné son consentement via le widget

**`index.html`** :
- Retirer le script Privyo global déjà ajouté (puisqu'on le charge maintenant inline dans le formulaire uniquement)

### Détail technique

Le script externe sera chargé dynamiquement via `useEffect` pour s'assurer que le `<div id="privyo-consent">` existe dans le DOM avant l'injection. On écoutera les changements dans ce div pour mettre à jour l'état `gdprConsent` et conditionner le bouton "Créer mon compte".

