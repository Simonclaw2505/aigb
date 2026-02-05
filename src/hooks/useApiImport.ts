/**
 * API Import Hook
 * Handles parsing, validation, and storage of OpenAPI specifications
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseOpenAPISpec, hashSpec, type ParsedSpec, type ParsedEndpoint } from "@/lib/openapi-parser";

interface UseApiImportOptions {
  projectId: string;
  onSuccess?: () => void;
}

interface ImportState {
  status: "idle" | "parsing" | "saving" | "success" | "error";
  parsedSpec: ParsedSpec | null;
  selectedEndpoints: Set<string>;
  rawContent: string;
  sourceUrl: string | null;
}

export function useApiImport({ projectId, onSuccess }: UseApiImportOptions) {
  const { toast } = useToast();
  const [state, setState] = useState<ImportState>({
    status: "idle",
    parsedSpec: null,
    selectedEndpoints: new Set(),
    rawContent: "",
    sourceUrl: null,
  });

  /**
   * Parse OpenAPI content from string
   */
  const parseContent = async (content: string, sourceUrl?: string) => {
    setState((prev) => ({ ...prev, status: "parsing", rawContent: content, sourceUrl: sourceUrl || null }));

    try {
      const parsed = parseOpenAPISpec(content);
      
      // Select all endpoints by default
      const allKeys = new Set(parsed.endpoints.map((ep) => `${ep.method}:${ep.path}`));
      
      setState((prev) => ({
        ...prev,
        status: parsed.errors.some((e) => e.severity === "error") ? "error" : "idle",
        parsedSpec: parsed,
        selectedEndpoints: allKeys,
      }));

      if (parsed.endpoints.length === 0 && parsed.errors.length === 0) {
        toast({
          variant: "destructive",
          title: "No endpoints found",
          description: "The specification doesn't contain any API endpoints.",
        });
      }

      return parsed;
    } catch (error: any) {
      setState((prev) => ({ ...prev, status: "error", parsedSpec: null }));
      toast({
        variant: "destructive",
        title: "Parse failed",
        description: error.message || "Failed to parse the specification",
      });
      return null;
    }
  };

  /**
   * Fetch and parse OpenAPI spec from URL
   */
  const fetchFromUrl = async (url: string) => {
    setState((prev) => ({ ...prev, status: "parsing" }));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      return await parseContent(content, url);
    } catch (error: any) {
      setState((prev) => ({ ...prev, status: "error" }));
      toast({
        variant: "destructive",
        title: "Fetch failed",
        description: error.message || "Could not fetch the specification from the URL",
      });
      return null;
    }
  };

  /**
   * Parse OpenAPI spec from file
   */
  const parseFromFile = async (file: File) => {
    setState((prev) => ({ ...prev, status: "parsing" }));

    try {
      const content = await file.text();
      return await parseContent(content);
    } catch (error: any) {
      setState((prev) => ({ ...prev, status: "error" }));
      toast({
        variant: "destructive",
        title: "Read failed",
        description: error.message || "Could not read the file",
      });
      return null;
    }
  };

  /**
   * Save the parsed spec and selected endpoints to the database
   */
  const saveToDatabase = async () => {
    if (!state.parsedSpec || state.selectedEndpoints.size === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to save",
        description: "Please parse a specification and select endpoints first.",
      });
      return false;
    }

    setState((prev) => ({ ...prev, status: "saving" }));

    try {
      // Calculate spec hash for change detection
      const specHash = await hashSpec(state.rawContent);

      // Determine source type
      const sourceType = state.rawContent.includes('"openapi"') || state.rawContent.includes('openapi:')
        ? "openapi"
        : state.rawContent.includes('"swagger"') || state.rawContent.includes('swagger:')
        ? "swagger"
        : "openapi";

      // Create api_source record
      const { data: apiSource, error: sourceError } = await supabase
        .from("api_sources")
        .insert({
          project_id: projectId,
          name: state.parsedSpec.title,
          description: state.parsedSpec.description,
          source_type: sourceType,
          version: state.parsedSpec.version,
          spec_url: state.sourceUrl,
          spec_content: JSON.parse(state.rawContent.startsWith("{") ? state.rawContent : JSON.stringify(parseOpenAPISpec(state.rawContent))),
          spec_hash: specHash,
          status: "active",
          parsed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Filter selected endpoints and insert them
      // Cast to Json type for Supabase compatibility
      const selectedEndpointData = state.parsedSpec.endpoints
        .filter((ep) => state.selectedEndpoints.has(`${ep.method}:${ep.path}`))
        .map((ep) => ({
          api_source_id: apiSource.id,
          operation_id: ep.operationId,
          name: ep.name,
          description: ep.description,
          method: ep.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
          path: ep.path,
          path_parameters: JSON.parse(JSON.stringify(ep.pathParameters)),
          query_parameters: JSON.parse(JSON.stringify(ep.queryParameters)),
          header_parameters: JSON.parse(JSON.stringify(ep.headerParameters)),
          request_body_schema: ep.requestBodySchema ? JSON.parse(JSON.stringify(ep.requestBodySchema)) : null,
          response_schemas: JSON.parse(JSON.stringify(ep.responseSchemas)),
          tags: ep.tags,
          status: "active" as const,
          is_deprecated: ep.isDeprecated,
        }));

      if (selectedEndpointData.length > 0) {
        const { error: endpointsError } = await supabase
          .from("endpoints")
          .insert(selectedEndpointData);

        if (endpointsError) throw endpointsError;
      }

      setState((prev) => ({ ...prev, status: "success" }));
      
      toast({
        title: "Import successful",
        description: `Imported ${selectedEndpointData.length} endpoints from "${state.parsedSpec.title}"`,
      });

      onSuccess?.();
      return true;
    } catch (error: any) {
      setState((prev) => ({ ...prev, status: "error" }));
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "Could not save to database",
      });
      return false;
    }
  };

  /**
   * Update selected endpoints
   */
  const setSelectedEndpoints = (selected: Set<string>) => {
    setState((prev) => ({ ...prev, selectedEndpoints: selected }));
  };

  /**
   * Reset the import state
   */
  const reset = () => {
    setState({
      status: "idle",
      parsedSpec: null,
      selectedEndpoints: new Set(),
      rawContent: "",
      sourceUrl: null,
    });
  };

  return {
    ...state,
    parseContent,
    fetchFromUrl,
    parseFromFile,
    saveToDatabase,
    setSelectedEndpoints,
    reset,
  };
}
