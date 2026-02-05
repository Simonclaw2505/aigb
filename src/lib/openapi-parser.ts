/**
 * OpenAPI Parser for MCP Foundry
 * Parses OpenAPI 3.x and Swagger 2.x specifications into normalized endpoints
 */

import yaml from "js-yaml";

// Types for parsed OpenAPI data
export interface ParsedEndpoint {
  operationId: string | null;
  name: string;
  description: string | null;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  path: string;
  tags: string[];
  pathParameters: ParameterDef[];
  queryParameters: ParameterDef[];
  headerParameters: ParameterDef[];
  requestBodySchema: object | null;
  responseSchemas: Record<string, object>;
  isDeprecated: boolean;
}

export interface ParameterDef {
  name: string;
  type: string;
  required: boolean;
  description: string | null;
  schema?: object;
}

export interface ParsedSpec {
  title: string;
  version: string;
  description: string | null;
  baseUrl: string | null;
  endpoints: ParsedEndpoint[];
  errors: ParseError[];
}

export interface ParseError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

// HTTP methods we support
const SUPPORTED_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

/**
 * Parse OpenAPI/Swagger specification from JSON or YAML string
 */
export function parseOpenAPISpec(content: string): ParsedSpec {
  const errors: ParseError[] = [];
  let spec: any;

  // Try parsing as JSON first, then YAML
  try {
    spec = JSON.parse(content);
  } catch {
    try {
      spec = yaml.load(content);
    } catch (yamlError: any) {
      return {
        title: "Unknown",
        version: "0.0.0",
        description: null,
        baseUrl: null,
        endpoints: [],
        errors: [{ path: "/", message: `Failed to parse: ${yamlError.message}`, severity: "error" }],
      };
    }
  }

  if (!spec || typeof spec !== "object") {
    return {
      title: "Unknown",
      version: "0.0.0",
      description: null,
      baseUrl: null,
      endpoints: [],
      errors: [{ path: "/", message: "Invalid specification format", severity: "error" }],
    };
  }

  // Detect spec version (OpenAPI 3.x vs Swagger 2.x)
  const isOpenAPI3 = spec.openapi?.startsWith("3");
  const isSwagger2 = spec.swagger?.startsWith("2");

  if (!isOpenAPI3 && !isSwagger2) {
    errors.push({
      path: "/",
      message: "Unsupported spec version. Please use OpenAPI 3.x or Swagger 2.x",
      severity: "warning",
    });
  }

  // Extract metadata
  const info = spec.info || {};
  const title = info.title || "Untitled API";
  const version = info.version || "0.0.0";
  const description = info.description || null;

  // Extract base URL
  let baseUrl: string | null = null;
  if (isOpenAPI3 && spec.servers?.[0]?.url) {
    baseUrl = spec.servers[0].url;
  } else if (isSwagger2) {
    const scheme = spec.schemes?.[0] || "https";
    const host = spec.host || "";
    const basePath = spec.basePath || "";
    if (host) {
      baseUrl = `${scheme}://${host}${basePath}`;
    }
  }

  // Parse paths and operations
  const endpoints: ParsedEndpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const method of SUPPORTED_METHODS) {
      const operation = (pathItem as any)[method];
      if (!operation) continue;

      try {
        const endpoint = parseOperation(
          path,
          method.toUpperCase() as ParsedEndpoint["method"],
          operation,
          pathItem,
          spec,
          isOpenAPI3
        );
        endpoints.push(endpoint);
      } catch (err: any) {
        errors.push({
          path: `${method.toUpperCase()} ${path}`,
          message: err.message,
          severity: "error",
        });
      }
    }
  }

  return {
    title,
    version,
    description,
    baseUrl,
    endpoints,
    errors,
  };
}

/**
 * Parse a single operation into a normalized endpoint
 */
function parseOperation(
  path: string,
  method: ParsedEndpoint["method"],
  operation: any,
  pathItem: any,
  spec: any,
  isOpenAPI3: boolean
): ParsedEndpoint {
  const operationId = operation.operationId || null;
  const summary = operation.summary || "";
  const description = operation.description || summary || null;
  const tags = operation.tags || [];
  const isDeprecated = operation.deprecated === true;

  // Generate a name from operationId or path
  const name = operationId || generateNameFromPath(method, path);

  // Combine path-level and operation-level parameters
  const allParameters = [
    ...(pathItem.parameters || []),
    ...(operation.parameters || []),
  ];

  // Parse parameters by location
  const pathParameters: ParameterDef[] = [];
  const queryParameters: ParameterDef[] = [];
  const headerParameters: ParameterDef[] = [];

  for (const param of allParameters) {
    const resolved = resolveRef(param, spec);
    if (!resolved) continue;

    const paramDef: ParameterDef = {
      name: resolved.name,
      type: getParameterType(resolved, isOpenAPI3),
      required: resolved.required === true,
      description: resolved.description || null,
      schema: isOpenAPI3 ? resolved.schema : undefined,
    };

    switch (resolved.in) {
      case "path":
        pathParameters.push(paramDef);
        break;
      case "query":
        queryParameters.push(paramDef);
        break;
      case "header":
        headerParameters.push(paramDef);
        break;
    }
  }

  // Parse request body (OpenAPI 3.x)
  let requestBodySchema: object | null = null;
  if (isOpenAPI3 && operation.requestBody) {
    const body = resolveRef(operation.requestBody, spec);
    if (body?.content) {
      const jsonContent = body.content["application/json"];
      if (jsonContent?.schema) {
        requestBodySchema = resolveRef(jsonContent.schema, spec) || jsonContent.schema;
      }
    }
  } else if (!isOpenAPI3) {
    // Swagger 2.x body parameter
    const bodyParam = allParameters.find((p: any) => resolveRef(p, spec)?.in === "body");
    if (bodyParam) {
      const resolved = resolveRef(bodyParam, spec);
      requestBodySchema = resolved?.schema || null;
    }
  }

  // Parse response schemas
  const responseSchemas: Record<string, object> = {};
  const responses = operation.responses || {};

  for (const [statusCode, response] of Object.entries(responses)) {
    const resolved = resolveRef(response, spec);
    if (!resolved) continue;

    if (isOpenAPI3) {
      const jsonContent = resolved.content?.["application/json"];
      if (jsonContent?.schema) {
        responseSchemas[statusCode] = resolveRef(jsonContent.schema, spec) || jsonContent.schema;
      }
    } else {
      if (resolved.schema) {
        responseSchemas[statusCode] = resolveRef(resolved.schema, spec) || resolved.schema;
      }
    }
  }

  return {
    operationId,
    name,
    description,
    method,
    path,
    tags,
    pathParameters,
    queryParameters,
    headerParameters,
    requestBodySchema,
    responseSchemas,
    isDeprecated,
  };
}

/**
 * Resolve a $ref to its target definition
 */
function resolveRef(obj: any, spec: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (!obj.$ref) return obj;

  const refPath = obj.$ref;
  const parts = refPath.replace(/^#\//, "").split("/");

  let current = spec;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return null;
  }

  return current;
}

/**
 * Get the type string for a parameter
 */
function getParameterType(param: any, isOpenAPI3: boolean): string {
  if (isOpenAPI3) {
    const schema = param.schema || {};
    return schema.type || "string";
  }
  return param.type || "string";
}

/**
 * Generate a human-readable name from method and path
 */
function generateNameFromPath(method: string, path: string): string {
  // Remove path parameters and clean up
  const cleanPath = path
    .replace(/\{[^}]+\}/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  const parts = cleanPath.split("_").filter(Boolean);
  const resource = parts[parts.length - 1] || "resource";

  const verbMap: Record<string, string> = {
    GET: "get",
    POST: "create",
    PUT: "update",
    PATCH: "patch",
    DELETE: "delete",
    HEAD: "head",
    OPTIONS: "options",
  };

  return `${verbMap[method] || method.toLowerCase()}_${resource}`;
}

/**
 * Validate OpenAPI specification and return validation errors
 */
export function validateOpenAPISpec(content: string): ParseError[] {
  const result = parseOpenAPISpec(content);
  return result.errors;
}

/**
 * Calculate a hash for the spec content (for change detection)
 */
export async function hashSpec(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
