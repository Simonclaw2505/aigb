

## Corriger le lien entre le connecteur et le secret API

### Probleme

Le secret contenant ta cle API a bien ete cree dans la table `secrets` (id: `a4d630d7-...`), mais le connecteur Productive n'y est pas lie : son champ `credential_secret_id` est reste `null`. Cela signifie que `action-runner` ne trouve jamais de credential a envoyer dans le header `X-Auth-Token`, d'ou le 401.

**Cause probable** : lors de la sauvegarde du connecteur, le code met a jour le connecteur existant via `.update()`, mais le `credentialSecretId` n'est pas correctement propage quand on cree un nouveau secret pour un connecteur deja existant.

### Corrections

**1. Correction immediate en base de donnees** (migration SQL)

Lier manuellement le secret existant au connecteur :

```text
UPDATE api_connectors 
SET credential_secret_id = 'a4d630d7-0e58-4d4b-96d1-b23215d52aca'
WHERE id = 'eecbae84-ce81-4610-b00b-d85b0677038c';
```

**2. Correction du bug dans `ConnectorsPanel.tsx`**

Examiner la logique `handleSave` pour s'assurer que lorsqu'un connecteur est mis a jour (mode edition) et qu'un nouveau secret est cree, le `credentialSecretId` est bien transmis dans l'objet `connectorData` lors de l'update. Le probleme pourrait etre que l'update du connecteur existant ne prend pas en compte le nouveau `credentialSecretId`.

**3. Verification de la valeur du secret**

La valeur stockee dans `encrypted_value` est `d453b011-c2db-4b4b-ae74-4d1feaf38e08`, ce qui ressemble a un UUID et non a une cle API typique. Il faudra verifier que c'est bien ta vraie cle API Productive.io. Si ce n'est pas le cas, il faudra re-saisir la bonne valeur.

### Resultat attendu

Apres ces corrections, `action-runner` trouvera le secret via `credential_secret_id`, lira `encrypted_value`, et l'enverra dans le header `X-Auth-Token` -- supprimant l'erreur 401.
