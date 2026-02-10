

## Corrections : affichage horizontal et pagination API

### Probleme 1 : Taille horizontale enorme

Le bloc `<pre>` qui affiche la reponse JSON du serveur n'a pas de contrainte de largeur maximale. Le JSON de Productive.io contient des lignes longues qui font deborder le conteneur horizontalement.

**Correction** : Ajouter les classes CSS `overflow-x-auto`, `max-w-full`, et `break-all` / `whitespace-pre-wrap` sur le `<pre>` pour forcer le retour a la ligne et empecher le debordement. Egalement ajouter `overflow-hidden` sur la Card parente.

### Probleme 2 : Un seul projet affiche

L'API Productive.io utilise la pagination par defaut (typiquement 30 elements par page). La reponse contient probablement un champ `meta` avec les infos de pagination, mais l'Edge Function retourne la reponse brute sans gerer la pagination. 

Comme c'est un mode **test/preview**, on ne va pas implementer la pagination complete, mais on va :
- Ajouter un parametre `page[size]` configurable pour que l'utilisateur puisse demander plus de resultats lors du test
- Afficher clairement dans l'apercu combien d'elements sont retournes et s'il y en a d'autres (info `meta`)

### Fichiers modifies

**`src/components/import/ManualApiConfig.tsx`** :
- Bloc "Reponse du serveur" : ajouter `overflow-hidden` sur la Card, et `whitespace-pre-wrap word-break-all` sur le `<pre>` pour empecher le debordement horizontal
- Ajouter un champ optionnel "Query parameters" dans le formulaire d'endpoint pour pouvoir ajouter `?page[size]=200` ou d'autres filtres
- Afficher un compteur d'elements quand la reponse contient un tableau `data` (ex: "1 projet retourne sur X au total")

### Details techniques

```text
Avant (ligne 384) :
  <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-48">

Apres :
  <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-48 max-w-full whitespace-pre-wrap break-all">

Card parente (ligne 379) :
  <Card className="overflow-hidden">
```

Pour la pagination, un message informatif sera affiche au-dessus du JSON :
```text
"3 elements retournes. L'API peut utiliser la pagination -- 
 ajoute ?page[size]=200 dans le chemin pour en recuperer plus."
```

