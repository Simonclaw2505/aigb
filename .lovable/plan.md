

# Correction : validation des inputs dans action-runner

## Probleme identifie

L'action `create_send` (POST /v3/mail/send) a un `input_schema` vide :
```json
{ "type": "object", "properties": {} }
```

Quand le LLM genere un plan avec des inputs (`from`, `to`, `subject`, `html_body`), le validateur dans `action-runner` (ligne 92-96) rejette chaque champ comme "Unknown field" car aucun n'est declare dans `properties`.

C'est un probleme a deux niveaux :

1. **Les schemas ne sont pas remplis** lors de l'import/creation des actions
2. **Le validateur est trop strict** : il rejette les champs inconnus meme quand le schema est vide (ce qui devrait signifier "accepter tout")

## Solution

### 1. Corriger le validateur dans `action-runner/index.ts`

Modifier `validateInputSchema` pour etre tolerant quand `properties` est vide. Si le schema ne definit aucune propriete, on considere que tous les champs sont acceptes (le schema n'a simplement pas ete configure).

```text
Fichier: supabase/functions/action-runner/index.ts
Fonction: validateInputSchema (ligne 79-124)

Changement: Si schema.properties est vide ou absent, 
sauter la verification des champs inconnus.
Garder la verification des champs requis et des types 
quand les proprietes sont definies.
```

### 2. Corriger aussi le dry-run dans `execute-plan`

Le `execute-plan` appelle `action-runner` pour l'execution reelle. Le dry-run ne passe pas par cette validation, donc il reussit. Mais l'execution echoue car `action-runner` valide.

Aucun changement necessaire dans `execute-plan` -- le fix dans `action-runner` suffit.

## Modification technique

### `supabase/functions/action-runner/index.ts`

Dans la fonction `validateInputSchema`, ajouter une condition au debut de la boucle de validation des champs :

```typescript
// Si properties est vide, ne pas rejeter les champs inconnus
const hasDefinedProperties = Object.keys(schemaProps).length > 0;

for (const [field, value] of Object.entries(inputs)) {
  const fieldSchema = schemaProps[field];
  if (!fieldSchema) {
    // Seulement rejeter si le schema definit explicitement des proprietes
    if (hasDefinedProperties) {
      errors.push(`Unknown field: ${field}`);
    }
    continue;
  }
  // ... reste de la validation inchange
}
```

## Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/action-runner/index.ts` | Tolerant aux champs inconnus quand properties est vide |

## Resultat attendu

- Si `input_schema.properties` est vide : tous les champs sont acceptes
- Si `input_schema.properties` definit des champs : seuls ces champs sont acceptes (comportement actuel)
- L'envoi de mail passera car le schema vide ne bloquera plus les inputs generes par le LLM

