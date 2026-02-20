

# Ajouter l'outil "Productive" a la bibliotheque

## Donnees de la carte

| Champ | Valeur |
|---|---|
| Nom | Productive |
| Slug | productive |
| Categorie | Productivite |
| URL de base | `https://api.productive.io/api/v2` |
| Type d'auth | custom (Header personnalise) |
| Nom du header | X-Auth-Token |
| Instructions d'auth | Generer un jeton API depuis Productive > Settings > API. Ajouter egalement l'ID de l'organisation dans le header X-Organization-Id. |
| Headers supplementaires | `{"Content-Type": "application/vnd.api+json", "X-Organization-Id": "<org_id>"}` |

## Endpoints (34 entrees)

Chaque ressource est declaree avec ses operations CRUD standard :

- GET /activities -- Lister les activites
- GET /approval_policies -- Lister les politiques de validation
- GET /approval_policy_assignments -- Lister les affectations de validation
- GET /approval_workflows -- Lister les workflows de validation
- GET /attachments -- Lister les fichiers attaches
- POST /attachments -- Creer un fichier attache
- GET /automatic_invoicing_rules -- Lister les regles de facturation auto
- GET /bank_accounts -- Lister les comptes bancaires
- GET /bills -- Lister les factures fournisseurs
- POST /bills -- Creer une facture fournisseur
- GET /boards -- Lister les tableaux
- GET /bookings -- Lister les reservations
- POST /bookings -- Creer une reservation
- GET /comments -- Lister les commentaires
- POST /comments -- Creer un commentaire
- GET /companies -- Lister les entreprises
- POST /companies -- Creer une entreprise
- GET /contact_entries -- Lister les contacts
- POST /contact_entries -- Creer un contact
- GET /contracts -- Lister les contrats
- POST /contracts -- Creer un contrat
- GET /deals -- Lister les budgets
- POST /deals -- Creer un budget
- GET /docs -- Lister les documents
- POST /docs -- Creer un document
- GET /invoices -- Lister les factures client
- POST /invoices -- Creer une facture client
- GET /people -- Lister les utilisateurs
- GET /projects -- Lister les projets
- POST /projects -- Creer un projet
- GET /task_lists -- Lister les listes de taches
- GET /tasks -- Lister les taches
- POST /tasks -- Creer une tache
- GET /time_entries -- Lister les saisies de temps
- POST /time_entries -- Creer une saisie de temps
- GET /workflows -- Lister les workflows
- GET /work_types -- Lister les types de prestations

## Implementation technique

**Fichier** : `src/pages/Tools.tsx` (ou via appel direct Supabase)

Inserer une ligne dans la table `tool_library` via le client Supabase avec toutes les donnees ci-dessus. Cela peut se faire :

- **Option A** : Via une migration SQL avec un `INSERT INTO tool_library (...)` contenant toutes les valeurs
- **Option B** : Via le code existant du `ToolLibraryForm` qui insere deja dans cette table

L'option A (migration SQL) est la plus fiable car elle garantit que l'outil est present en base sans dependre d'une action utilisateur.

La migration SQL inserera un enregistrement avec :
- Le champ `endpoints` en JSONB contenant les 37 entrees
- Le champ `extra_headers` en JSONB avec Content-Type et X-Organization-Id
- `is_published` a `true`

