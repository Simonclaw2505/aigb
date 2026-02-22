

# Mettre a jour la cle API SendGrid pour que le simulateur fonctionne

## Probleme

L'action `create_send` est liee a l'ancien connecteur SendGrid dont la cle API est expiree (quota epuise). La nouvelle cle que tu as fournie n'a pas ete enregistree dans le bon secret.

## Solution

Il y a deux options. Je recommande l'option 1 (la plus simple) :

### Option 1 : Mettre a jour le secret existant (recommandee)

Mettre a jour directement la valeur du secret `SendGrid_credential` (id: `ee602115-5cbf-4c56-bc21-c8e6213af1dd`) avec la nouvelle cle API. Cela ne necessite aucune modification de code -- l'action `create_send` continuera d'utiliser le meme connecteur, mais avec la nouvelle cle.

**Etape technique** : Appel SQL pour mettre a jour la colonne `encrypted_value` du secret `SendGrid_credential` avec la nouvelle cle `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`.

### Option 2 : Repointer l'action vers le connecteur "SendGrid v2"

Modifier le connecteur lie a l'api_source `d67b9ae3` pour utiliser le secret `SendGrid v2_credential` a la place. Plus complexe et risque de casser d'autres actions liees.

---

## Fichiers modifies

Aucun fichier de code a modifier. Seule une migration SQL est necessaire pour mettre a jour la valeur du secret dans la table `secrets`.

## Remarque importante

La nouvelle cle est liee au compte `ahlybebo007@gmail.com`. Assure-toi que cette adresse est bien configuree comme **Verified Sender** dans le dashboard SendGrid de ce nouveau compte.

