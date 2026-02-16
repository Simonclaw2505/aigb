

# Sauvegarder la clé API lors de la configuration manuelle d'un outil

## Problème

Quand vous configurez un outil manuellement (page Import), vous entrez votre clé API SendGrid pour tester la connexion. Le test fonctionne car la clé est envoyée dans les headers. Mais lors de la sauvegarde, **la clé n'est jamais stockée** : le connecteur est créé sans `credential_secret_id`, donc l'action-runner ne peut pas s'authentifier ensuite.

Le panneau Connecteurs (`ConnectorsPanel`) a déjà cette logique (créer un secret puis le lier), mais `ManualApiConfig` ne l'a pas.

## Solution

Modifier `ManualApiConfig.tsx` pour, lors de la sauvegarde :

1. **Créer un secret** dans la table `secrets` contenant la clé API (si une valeur d'authentification a été saisie)
2. **Lier ce secret** au connecteur via `credential_secret_id`

## Modification technique

### `src/components/import/ManualApiConfig.tsx`

Dans la fonction `handleSave`, entre la création de l'`api_source` et la création du connecteur, ajouter :

```typescript
// Si l'utilisateur a saisi une clé API, la stocker comme secret
let credentialSecretId: string | null = null;

if (authValue.trim() && authType !== "none") {
  const { data: secretData, error: secretError } = await supabase
    .from("secrets")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      name: `${apiName.trim()}_credential`,
      description: `API credential for ${apiName.trim()}`,
      encrypted_value: authValue.trim(),
      is_active: true,
    })
    .select("id")
    .single();

  if (secretError) throw secretError;
  credentialSecretId = secretData.id;
}
```

Puis dans l'insert du connecteur, ajouter le champ :

```typescript
credential_secret_id: credentialSecretId,
```

## Fichiers concernés

| Fichier | Modification |
|---------|-------------|
| `src/components/import/ManualApiConfig.tsx` | Stocker la clé API comme secret et la lier au connecteur |

## Résultat attendu

- Quand vous sauvegardez un outil avec une clé API, celle-ci est stockée dans `secrets` et liée au connecteur
- L'action-runner pourra ensuite récupérer le secret et construire le header d'authentification
- Le test et l'exécution réelle utiliseront la même clé
