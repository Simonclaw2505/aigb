

## Intégration du widget RGPD au signup

### Approche

1. **Ajouter le script externe dans `index.html`** : insérer la balise `<script>` avant la fermeture de `</body>` pour charger le widget sur toutes les pages (il ne s'affichera que selon sa propre config).

2. **Aucune modification du formulaire Auth.tsx nécessaire** si le widget fonctionne en overlay/popup autonome. Si par contre il faut conditionner le signup à un consentement explicite (checkbox), on ajoutera une case à cocher "J'accepte la politique de confidentialité" dans le formulaire d'inscription qui bloque le bouton tant qu'elle n'est pas cochée.

### Fichiers modifiés

- **`index.html`** : ajout du script widget RGPD
- **`src/pages/Auth.tsx`** : ajout d'une checkbox de consentement RGPD dans le formulaire signup (optionnel, recommandé pour conformité)

### Détails techniques

- Script ajouté : `<script src="https://fa4be116-055d-4827-8894-b21b1fe97aaf.lovableproject.com/widget.js" data-api-key="pk_8a1aaabaac2049eb88fde2c2eb27e93b"></script>`
- Checkbox liée à un état `gdprConsent` qui désactive le bouton "Créer mon compte" si non coché
- Validation Zod étendue pour inclure le consentement

