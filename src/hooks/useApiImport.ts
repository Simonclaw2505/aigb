/**
 * API Import Hook
 * Handles parsing, validation, and storage of OpenAPI specifications
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseOpenAPISpec, hashSpec, type ParsedSpec, type ParsedEndpoint } from "@/lib/openapi-parser";
import { useSessionState, clearSessionKeys } from "@/hooks/useSessionState";

interface UseApiImportOptions {
  projectId: string;
  organizationId: string;
  onSuccess?: () => void;
}

interface ImportState {
  status: "idle" | "parsing" | "saving" | "success" | "error";
}

export function useApiImport({ projectId, organizationId, onSuccess }: UseApiImportOptions) {
  const { toast } = useToast();
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const [parsedSpec, setParsedSpec] = useSessionState<ParsedSpec | null>("import_parsed_spec", null);
  const [selectedEndpointsArr, setSelectedEndpointsArr] = useSessionState<string[]>("import_selected_endpoints", []);
  const [rawContent, setRawContent] = useSessionState("import_raw_content", "");
  const [sourceUrl, setSourceUrl] = useSessionState<string | null>("import_source_url", null);

  const selectedEndpoints = new Set(selectedEndpointsArr);

  /**
   * Parse OpenAPI content from string
   */
  const parseContent = async (content: string, srcUrl?: string) => {
    setState({ status: "parsing" });
    setRawContent(content);
    setSourceUrl(srcUrl || null);

    try {
      const parsed = parseOpenAPISpec(content);
      
      // Select all endpoints by default
      const allKeys = parsed.endpoints.map((ep) => `${ep.method}:${ep.path}`);
      
      setState({
        status: parsed.errors.some((e) => e.severity === "error") ? "error" : "idle",
      });
      setParsedSpec(parsed);
      setSelectedEndpointsArr(allKeys);

      if (parsed.endpoints.length === 0 && parsed.errors.length === 0) {
        toast({
          variant: "destructive",
          title: "No endpoints found",
          description: "The specification doesn't contain any API endpoints.",
        });
      }

      return parsed;
    } catch (error: any) {
      setState({ status: "error" });
      setParsedSpec(null);
      toast({
        variant: "destructive",
        title: "Parse failed",
        description: error.message || "Failed to parse the specification",
      });
      return null;
    }
  };

  /**
   * Fetch and parse OpenAPI spec from URL via proxy Edge Function
   */
  const fetchFromUrl = async (url: string) => {
    setState({ status: "parsing" });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-openapi-spec', {
        body: { url }
      });

      if (error) throw new Error(error.message || "Proxy fetch failed");
      if (data?.error) throw new Error(data.error);
      if (!data?.content) throw new Error("No content received");

      return await parseContent(data.content, url);
    } catch (error: any) {
      setState({ status: "error" });
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
    setState({ status: "parsing" });

    try {
      const content = await file.text();
      return await parseContent(content);
    } catch (error: any) {
      setState({ status: "error" });
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
    if (!parsedSpec || selectedEndpoints.size === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to save",
        description: "Please parse a specification and select endpoints first.",
      });
      return false;
    }

    setState({ status: "saving" });

    try {
      const specHash = await hashSpec(rawContent);

      const sourceType = rawContent.includes('"openapi"') || rawContent.includes('openapi:')
        ? "openapi"
        : rawContent.includes('"swagger"') || rawContent.includes('swagger:')
        ? "swagger"
        : "openapi";

      const { data: apiSource, error: sourceError } = await supabase
        .from("api_sources")
        .insert({
          organization_id: organizationId,
          project_id: projectId,
          name: parsedSpec.title,
          description: parsedSpec.description,
          source_type: sourceType,
          version: parsedSpec.version,
          spec_url: sourceUrl,
          spec_content: JSON.parse(rawContent.startsWith("{") ? rawContent : JSON.stringify(parseOpenAPISpec(rawContent))),
          spec_hash: specHash,
          status: "active",
          parsed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      const selectedEndpointData = parsedSpec.endpoints
        .filter((ep) => selectedEndpoints.has(`${ep.method}:${ep.path}`))
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

      setState({ status: "success" });
      
      toast({
        title: "Import successful",
        description: `Imported ${selectedEndpointData.length} endpoints from "${parsedSpec.title}"`,
      });

      // Clear persisted data after successful save
      clearSessionKeys("import_");
      onSuccess?.();
      return true;
    } catch (error: any) {
      setState({ status: "error" });
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "Could not save to database",
      });
      return false;
    }
  };

  const setSelectedEndpointsSet = (selected: Set<string>) => {
    setSelectedEndpointsArr(Array.from(selected));
  };

  const reset = () => {
    setState({ status: "idle" });
    clearSessionKeys("import_");
    setParsedSpec(null);
    setSelectedEndpointsArr([]);
    setRawContent("");
    setSourceUrl(null);
  };

  return {
    status: state.status,
    parsedSpec,
    selectedEndpoints,
    rawContent,
    sourceUrl,
    parseContent,
    fetchFromUrl,
    parseFromFile,
    saveToDatabase,
    setSelectedEndpoints: setSelectedEndpointsSet,
    reset,
  };
}
