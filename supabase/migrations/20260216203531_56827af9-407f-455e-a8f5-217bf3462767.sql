
-- Create tool_library table (global, not org-scoped)
CREATE TABLE public.tool_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  category text NOT NULL,
  logo_url text,
  base_url text NOT NULL,
  auth_type text NOT NULL DEFAULT 'bearer',
  auth_header_name text DEFAULT 'Authorization',
  auth_instructions text,
  extra_headers jsonb DEFAULT '{}',
  endpoints jsonb DEFAULT '[]',
  is_published boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tool_library ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read published entries
CREATE POLICY "Authenticated users can view published tools"
ON public.tool_library FOR SELECT
USING (auth.role() = 'authenticated' AND is_published = true);

-- INSERT: any authenticated user can add (restrict later)
CREATE POLICY "Authenticated users can insert tools"
ON public.tool_library FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: any authenticated user can update (restrict later)
CREATE POLICY "Authenticated users can update tools"
ON public.tool_library FOR UPDATE
USING (auth.role() = 'authenticated');

-- DELETE: any authenticated user can delete (restrict later)
CREATE POLICY "Authenticated users can delete tools"
ON public.tool_library FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_tool_library_updated_at
BEFORE UPDATE ON public.tool_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Salesforce
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('Salesforce', 'salesforce', 'CRM leader mondial. Accédez aux objets, contacts, opportunités et exécutez des requêtes SOQL.', 'CRM', 'https://your-domain.my.salesforce.com/services/data/v61.0/', 'bearer', 'Authorization', 'Utilisez OAuth 2.0 pour obtenir un access_token via le flux Connected App de Salesforce.', '{}', '[
  {"method":"GET","path":"/services/data/v61.0/","name":"Liste des ressources","description":"Retourne les ressources REST disponibles"},
  {"method":"GET","path":"/services/data/v61.0/sobjects","name":"Liste des objets","description":"Retourne la liste de tous les objets Salesforce"},
  {"method":"GET","path":"/services/data/v61.0/sobjects/Account/describe","name":"Describe Account","description":"Retourne les métadonnées de l''objet Account"},
  {"method":"POST","path":"/services/data/v61.0/sobjects/Account","name":"Créer un Account","description":"Crée un nouvel objet Account"},
  {"method":"GET","path":"/services/data/v61.0/sobjects/Account/{id}","name":"Lire un Account","description":"Retourne un Account par son ID"},
  {"method":"PATCH","path":"/services/data/v61.0/sobjects/Account/{id}","name":"Modifier un Account","description":"Met à jour un Account existant"},
  {"method":"DELETE","path":"/services/data/v61.0/sobjects/Account/{id}","name":"Supprimer un Account","description":"Supprime un Account par son ID"},
  {"method":"GET","path":"/services/data/v61.0/query","name":"Query SOQL","description":"Exécute une requête SOQL (paramètre q=)"}
]');

-- Seed: HubSpot
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('HubSpot', 'hubspot', 'Plateforme CRM tout-en-un. Gérez contacts, deals et lancez des recherches.', 'CRM', 'https://api.hubapi.com', 'bearer', 'Authorization', 'Créez une Private App dans HubSpot > Settings > Integrations > Private Apps pour obtenir un token.', '{}', '[
  {"method":"POST","path":"/crm/v3/objects/contacts","name":"Créer un contact","description":"Crée un nouveau contact"},
  {"method":"GET","path":"/crm/v3/objects/contacts/{id}","name":"Lire un contact","description":"Retourne un contact par ID"},
  {"method":"GET","path":"/crm/v3/objects/contacts","name":"Lister les contacts","description":"Retourne la liste des contacts"},
  {"method":"PATCH","path":"/crm/v3/objects/contacts/{id}","name":"Modifier un contact","description":"Met à jour un contact existant"},
  {"method":"GET","path":"/crm/v3/objects/deals","name":"Lister les deals","description":"Retourne la liste des deals"},
  {"method":"POST","path":"/crm/v3/objects/deals","name":"Créer un deal","description":"Crée un nouveau deal"},
  {"method":"POST","path":"/crm/v3/objects/contacts/search","name":"Rechercher des contacts","description":"Recherche de contacts avec filtres"}
]');

-- Seed: Pipedrive
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('Pipedrive', 'pipedrive', 'CRM axé sur la vente. Gérez deals, personnes et organisations.', 'CRM', 'https://{company}.pipedrive.com/api/v1/', 'custom', 'x-api-token', 'Trouvez votre API Token dans Pipedrive > Paramètres > Préférences personnelles > API.', '{}', '[
  {"method":"GET","path":"/deals","name":"Lister les deals","description":"Retourne tous les deals"},
  {"method":"POST","path":"/deals","name":"Créer un deal","description":"Crée un nouveau deal"},
  {"method":"GET","path":"/deals/{id}","name":"Lire un deal","description":"Retourne un deal par ID"},
  {"method":"PUT","path":"/deals/{id}","name":"Modifier un deal","description":"Met à jour un deal existant"},
  {"method":"GET","path":"/persons","name":"Lister les personnes","description":"Retourne toutes les personnes"},
  {"method":"POST","path":"/persons","name":"Créer une personne","description":"Crée une nouvelle personne"},
  {"method":"GET","path":"/organizations","name":"Lister les organisations","description":"Retourne toutes les organisations"}
]');

-- Seed: QuickBooks Online
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('QuickBooks Online', 'quickbooks', 'Logiciel de comptabilité Intuit. Gérez clients, factures et requêtes.', 'Comptabilité', 'https://quickbooks.api.intuit.com/v3/company/{realmId}/', 'bearer', 'Authorization', 'Utilisez OAuth 2.0 via le portail développeur Intuit pour obtenir un access_token.', '{}', '[
  {"method":"GET","path":"/v3/company/{realmId}/customer/{id}","name":"Lire un client","description":"Retourne un client par ID"},
  {"method":"POST","path":"/v3/company/{realmId}/customer","name":"Créer un client","description":"Crée un nouveau client"},
  {"method":"POST","path":"/v3/company/{realmId}/invoice","name":"Créer une facture","description":"Crée une nouvelle facture"},
  {"method":"GET","path":"/v3/company/{realmId}/invoice/{id}","name":"Lire une facture","description":"Retourne une facture par ID"},
  {"method":"POST","path":"/v3/company/{realmId}/query","name":"Query","description":"Exécute une requête sur les données QuickBooks"},
  {"method":"GET","path":"/v3/company/{realmId}/companyinfo/{realmId}","name":"Info entreprise","description":"Retourne les informations de l''entreprise"}
]');

-- Seed: Xero
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('Xero', 'xero', 'Comptabilité cloud. Gérez contacts, factures et employés.', 'Comptabilité', 'https://api.xero.com/api.xro/2.0/', 'bearer', 'Authorization', 'Utilisez OAuth 2.0 via le Xero Developer Portal. N''oubliez pas de fournir le Xero-tenant-id.', '{"Xero-tenant-id": "<votre_tenant_id>", "Accept": "application/json"}', '[
  {"method":"GET","path":"/Contacts","name":"Lister les contacts","description":"Retourne tous les contacts"},
  {"method":"POST","path":"/Contacts","name":"Créer un contact","description":"Crée un nouveau contact"},
  {"method":"GET","path":"/Invoices","name":"Lister les factures","description":"Retourne toutes les factures"},
  {"method":"POST","path":"/Invoices","name":"Créer une facture","description":"Crée une nouvelle facture"},
  {"method":"GET","path":"/Employees","name":"Lister les employés","description":"Retourne tous les employés"}
]');

-- Seed: Pennylane
INSERT INTO public.tool_library (name, slug, description, category, base_url, auth_type, auth_header_name, auth_instructions, extra_headers, endpoints) VALUES
('Pennylane', 'pennylane', 'Solution de comptabilité française. Gérez abonnements et informations de compte.', 'Comptabilité', 'https://api.pennylane.com', 'bearer', 'Authorization', 'Générez une clé API depuis Pennylane > Paramètres > API.', '{}', '[
  {"method":"GET","path":"/v1/me","name":"Test connexion","description":"Vérifie la connexion et retourne les infos du compte"},
  {"method":"GET","path":"/api/external/v2/billing_subscriptions","name":"Lister les abonnements","description":"Retourne la liste des abonnements"},
  {"method":"POST","path":"/api/external/v2/billing_subscriptions","name":"Créer un abonnement","description":"Crée un nouvel abonnement"},
  {"method":"PUT","path":"/api/external/v2/billing_subscriptions/{id}","name":"Modifier un abonnement","description":"Met à jour un abonnement existant"}
]');
