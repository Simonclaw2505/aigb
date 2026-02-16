

# Rendre les champs Schema et Examples editables

## Probleme

Dans `ActionBuilderForm.tsx`, les textareas JSON (input schema, output schema, expected params des examples) utilisent `JSON.parse()` dans le `onChange`. Pendant la frappe, le JSON intermediaire est invalide, donc le `catch` ignore la modification et le texte ne bouge pas.

## Solution

Remplacer le pattern "parse a chaque frappe" par des **etats texte intermediaires** avec validation au `onBlur` (quand on quitte le champ) et indicateur visuel d'erreur.

## Modifications dans `src/components/actions/ActionBuilderForm.tsx`

### 1. Nouveaux etats texte

Ajouter des states string pour stocker le texte brut des champs JSON :
- `inputSchemaText` et `inputSchemaError`
- `outputSchemaText` et `outputSchemaError`

Initialises avec `JSON.stringify(formData.inputSchema, null, 2)` dans un `useEffect` qui reagit aux changements de `formData`.

### 2. Onglet Schema - Input Schema (lignes ~370-390)

Remplacer :
```text
value={JSON.stringify(formData.inputSchema, null, 2)}
onChange={(e) => { try { updateField("inputSchema", JSON.parse(e.target.value)); } catch {} }}
```

Par :
```text
value={inputSchemaText}
onChange={(e) => setInputSchemaText(e.target.value)}
onBlur={() => { try { updateField("inputSchema", JSON.parse(inputSchemaText)); clearError(); } catch { setError(); } }}
className={error ? "border-red-500" : ""}
```
+ message d'erreur rouge sous le textarea si JSON invalide.

### 3. Onglet Schema - Output Schema (lignes ~395-410)

Meme traitement pour le output schema.

### 4. Onglet Examples - Expected Params (lignes ~450-465)

Pour chaque example, stocker le texte de `expectedParams` dans un state local (Map par index) avec le meme pattern : edition libre + parse au blur + indicateur d'erreur.

### 5. Validation a la sauvegarde

Avant d'appeler `onSave`, verifier que tous les champs JSON sont valides. Si invalide, afficher un toast et basculer sur l'onglet concerne.

## Fichier modifie

| Fichier | Modification |
|---------|-------------|
| `src/components/actions/ActionBuilderForm.tsx` | Etats texte intermediaires pour tous les champs JSON, validation au blur, indicateurs d'erreur visuels, validation avant sauvegarde |

