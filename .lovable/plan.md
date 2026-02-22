

# Fix: les placeholders du body_template ne sont pas resolus

## Probleme

L'erreur SendGrid "The from email does not contain a valid address" vient du fait que les placeholders `{{from}}`, `{{to}}`, etc. ne sont **pas remplaces** dans le body_template. SendGrid recoit litteralement la chaine `"{{from}}"` au lieu de l'adresse email.

**Cause racine** : le simulateur envoie les inputs sous la forme `{body: {from: "...", to: "...", subject: "...", html: "..."}}` (objet imbrique), mais `applyBodyTemplate` cherche les cles `from`, `to`, `subject`, `html_content` **au premier niveau** de `modifiedInputs`. Comme elles sont imbriquees dans `body`, les placeholders restent non resolus.

## Solution

Modifier `action-runner/index.ts` (lignes 623-631) pour aplatir les inputs avant d'appliquer le body_template : si `modifiedInputs` contient une cle `body` qui est un objet, utiliser son contenu comme source des placeholders.

### Changement technique

Dans `supabase/functions/action-runner/index.ts`, avant l'appel a `applyBodyTemplate`, ajouter une logique de "flattening" :

```typescript
// Flatten: if inputs have a nested "body" object, merge its keys to top level
// so that body_template placeholders like {{from}} can be resolved
let templateInputs = modifiedInputs;
if (modifiedInputs.body && typeof modifiedInputs.body === "object" && !Array.isArray(modifiedInputs.body)) {
  templateInputs = { ...modifiedInputs, ...(modifiedInputs.body as Record<string, unknown>) };
}
const transformedBody = applyBodyTemplate(bodyTemplate, templateInputs);
```

Egalement, ajouter un mapping `html` vers `html_content` car le simulateur envoie `html` mais le template attend `{{html_content}}` :

```typescript
if (templateInputs.html && !templateInputs.html_content) {
  templateInputs.html_content = templateInputs.html;
}
```

Un seul fichier a modifier : `supabase/functions/action-runner/index.ts`.

