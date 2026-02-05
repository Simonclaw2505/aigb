/**
 * Action Suggestion Engine
 * Auto-generates action names, descriptions, and risk levels from endpoint data
 */

import type { ParsedEndpoint } from "@/lib/openapi-parser";

export type RiskLevel = "read_only" | "safe_write" | "risky_write" | "irreversible";

export interface ActionSuggestion {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  isIdempotent: boolean;
  examples: ActionExample[];
  constraints: ActionConstraints;
}

export interface ActionExample {
  prompt: string;
  expectedParams: Record<string, any>;
}

export interface ActionConstraints {
  rateLimit?: {
    requests: number;
    windowSeconds: number;
  };
  maxRows?: number;
  allowedFields?: string[];
  forbiddenFields?: string[];
  requiresConfirmation?: boolean;
  timeout?: number;
}

// Verb mappings for generating action names
const METHOD_VERBS: Record<string, string[]> = {
  GET: ["get", "fetch", "retrieve", "list", "search", "find"],
  POST: ["create", "add", "submit", "send", "register"],
  PUT: ["update", "replace", "set", "modify"],
  PATCH: ["update", "patch", "modify", "change"],
  DELETE: ["delete", "remove", "cancel", "revoke"],
  HEAD: ["check", "verify", "test"],
  OPTIONS: ["options", "capabilities"],
};

// Keywords that suggest higher risk
const HIGH_RISK_KEYWORDS = [
  "delete", "remove", "destroy", "purge", "drop", "terminate",
  "payment", "charge", "refund", "transfer", "withdraw",
  "password", "credential", "secret", "token",
  "admin", "sudo", "root", "superuser",
];

const MEDIUM_RISK_KEYWORDS = [
  "update", "modify", "change", "edit", "patch",
  "create", "add", "insert", "post",
  "send", "email", "notify", "message",
  "approve", "reject", "confirm",
];

/**
 * Generate action name from endpoint
 */
export function suggestActionName(endpoint: ParsedEndpoint): string {
  // Use operationId if available and well-formatted
  if (endpoint.operationId) {
    const cleaned = endpoint.operationId
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "")
      .replace(/-/g, "_")
      .replace(/__+/g, "_");
    
    // Ensure it starts with a verb
    const verbs = METHOD_VERBS[endpoint.method] || ["perform"];
    if (!verbs.some(v => cleaned.startsWith(v))) {
      return `${verbs[0]}_${cleaned}`;
    }
    return cleaned;
  }

  // Generate from path
  const pathParts = endpoint.path
    .replace(/\{[^}]+\}/g, "") // Remove path parameters
    .split("/")
    .filter(Boolean)
    .map(part => part.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  const resource = pathParts[pathParts.length - 1] || "resource";
  const verb = METHOD_VERBS[endpoint.method]?.[0] || "perform";

  // Singularize for single-resource operations
  const hasIdParam = endpoint.path.includes("{") && 
    (endpoint.method === "GET" || endpoint.method === "PUT" || 
     endpoint.method === "PATCH" || endpoint.method === "DELETE");
  
  const resourceName = hasIdParam 
    ? singularize(resource) 
    : resource;

  return `${verb}_${resourceName}`.toLowerCase();
}

/**
 * Generate action description from endpoint
 */
export function suggestActionDescription(endpoint: ParsedEndpoint): string {
  // Use existing description if good
  if (endpoint.description && endpoint.description.length > 20) {
    return endpoint.description;
  }

  const verb = getVerbPhrase(endpoint.method);
  const resource = extractResourceName(endpoint.path);
  const hasId = endpoint.path.includes("{");

  if (hasId && endpoint.method === "GET") {
    return `${verb} a specific ${singularize(resource)} by its identifier`;
  }
  if (!hasId && endpoint.method === "GET") {
    return `${verb} a list of ${resource}`;
  }
  if (endpoint.method === "POST") {
    return `Create a new ${singularize(resource)}`;
  }
  if (endpoint.method === "PUT" || endpoint.method === "PATCH") {
    return `Update an existing ${singularize(resource)}`;
  }
  if (endpoint.method === "DELETE") {
    return `Delete a ${singularize(resource)}`;
  }

  return `${verb} ${resource}`;
}

/**
 * Suggest risk level based on method and path analysis
 */
export function suggestRiskLevel(endpoint: ParsedEndpoint): RiskLevel {
  const method = endpoint.method;
  const pathLower = endpoint.path.toLowerCase();
  const nameLower = (endpoint.operationId || endpoint.name || "").toLowerCase();
  const descLower = (endpoint.description || "").toLowerCase();
  const combined = `${pathLower} ${nameLower} ${descLower}`;

  // DELETE is usually irreversible
  if (method === "DELETE") {
    // Check if it's a soft delete or archival
    if (combined.includes("archive") || combined.includes("soft") || combined.includes("disable")) {
      return "risky_write";
    }
    return "irreversible";
  }

  // GET, HEAD, OPTIONS are read-only
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return "read_only";
  }

  // Check for high-risk keywords
  if (HIGH_RISK_KEYWORDS.some(kw => combined.includes(kw))) {
    return "irreversible";
  }

  // POST/PUT/PATCH with certain patterns
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    // Financial operations
    if (combined.includes("payment") || combined.includes("charge") || 
        combined.includes("transfer") || combined.includes("refund")) {
      return "irreversible";
    }
    
    // User/auth operations
    if (combined.includes("password") || combined.includes("credential")) {
      return "risky_write";
    }

    // PUT typically replaces entire resource
    if (method === "PUT") {
      return "risky_write";
    }

    // PATCH is usually safer
    if (method === "PATCH") {
      return "safe_write";
    }

    // POST creates new resources
    return "safe_write";
  }

  return "safe_write";
}

/**
 * Suggest if action is idempotent
 */
export function suggestIdempotency(endpoint: ParsedEndpoint): boolean {
  const method = endpoint.method;
  
  // GET, HEAD, OPTIONS, PUT, DELETE are typically idempotent
  if (["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(method)) {
    return true;
  }
  
  // POST and PATCH are typically not idempotent
  return false;
}

/**
 * Generate example prompts for an action
 */
export function suggestExamples(endpoint: ParsedEndpoint): ActionExample[] {
  const resource = extractResourceName(endpoint.path);
  const singular = singularize(resource);
  const examples: ActionExample[] = [];

  const hasIdParam = endpoint.pathParameters.some(p => 
    p.name.toLowerCase().includes("id")
  );

  switch (endpoint.method) {
    case "GET":
      if (hasIdParam) {
        examples.push({
          prompt: `Get the ${singular} with ID 123`,
          expectedParams: { id: "123" },
        });
        examples.push({
          prompt: `Show me details for ${singular} abc-456`,
          expectedParams: { id: "abc-456" },
        });
        examples.push({
          prompt: `Fetch information about that ${singular}`,
          expectedParams: {},
        });
      } else {
        examples.push({
          prompt: `List all ${resource}`,
          expectedParams: {},
        });
        examples.push({
          prompt: `Show me the ${resource}`,
          expectedParams: {},
        });
        examples.push({
          prompt: `Get ${resource} from the last week`,
          expectedParams: {},
        });
      }
      break;

    case "POST":
      examples.push({
        prompt: `Create a new ${singular}`,
        expectedParams: {},
      });
      examples.push({
        prompt: `Add a ${singular} called "Example"`,
        expectedParams: { name: "Example" },
      });
      examples.push({
        prompt: `Set up a new ${singular} for the project`,
        expectedParams: {},
      });
      break;

    case "PUT":
    case "PATCH":
      examples.push({
        prompt: `Update the ${singular} with ID 123`,
        expectedParams: { id: "123" },
      });
      examples.push({
        prompt: `Change the name of ${singular} to "New Name"`,
        expectedParams: { name: "New Name" },
      });
      examples.push({
        prompt: `Modify that ${singular}'s settings`,
        expectedParams: {},
      });
      break;

    case "DELETE":
      examples.push({
        prompt: `Delete the ${singular} with ID 123`,
        expectedParams: { id: "123" },
      });
      examples.push({
        prompt: `Remove that ${singular}`,
        expectedParams: {},
      });
      examples.push({
        prompt: `Get rid of the old ${singular}`,
        expectedParams: {},
      });
      break;
  }

  return examples;
}

/**
 * Suggest default constraints based on risk level and method
 */
export function suggestConstraints(
  endpoint: ParsedEndpoint,
  riskLevel: RiskLevel
): ActionConstraints {
  const constraints: ActionConstraints = {};

  // Rate limiting based on risk
  switch (riskLevel) {
    case "irreversible":
      constraints.rateLimit = { requests: 5, windowSeconds: 60 };
      constraints.requiresConfirmation = true;
      constraints.timeout = 30000;
      break;
    case "risky_write":
      constraints.rateLimit = { requests: 20, windowSeconds: 60 };
      constraints.timeout = 30000;
      break;
    case "safe_write":
      constraints.rateLimit = { requests: 60, windowSeconds: 60 };
      constraints.timeout = 15000;
      break;
    case "read_only":
      constraints.rateLimit = { requests: 100, windowSeconds: 60 };
      constraints.timeout = 10000;
      break;
  }

  // Max rows for list endpoints
  if (endpoint.method === "GET" && !endpoint.path.includes("{")) {
    constraints.maxRows = 100;
  }

  return constraints;
}

/**
 * Generate complete action suggestion from endpoint
 */
export function generateActionSuggestion(endpoint: ParsedEndpoint): ActionSuggestion {
  const riskLevel = suggestRiskLevel(endpoint);
  
  return {
    name: suggestActionName(endpoint),
    description: suggestActionDescription(endpoint),
    riskLevel,
    isIdempotent: suggestIdempotency(endpoint),
    examples: suggestExamples(endpoint),
    constraints: suggestConstraints(endpoint, riskLevel),
  };
}

// Helper functions
function getVerbPhrase(method: string): string {
  const verbs: Record<string, string> = {
    GET: "Retrieve",
    POST: "Create",
    PUT: "Update",
    PATCH: "Modify",
    DELETE: "Delete",
    HEAD: "Check",
    OPTIONS: "Get options for",
  };
  return verbs[method] || "Perform operation on";
}

function extractResourceName(path: string): string {
  const parts = path
    .replace(/\{[^}]+\}/g, "")
    .split("/")
    .filter(Boolean)
    .map(p => p.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  
  return parts[parts.length - 1] || "resource";
}

function singularize(word: string): string {
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("es") && !word.endsWith("ss")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}
