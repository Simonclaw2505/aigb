/**
 * Export management hook for MCP Foundry
 * Handles versioned MCP package generation and retrieval
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Json } from "@/integrations/supabase/types";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  examples?: Array<{ input: Record<string, unknown>; output?: Record<string, unknown> }>;
  riskLevel: "read_only" | "safe_write" | "risky_write" | "irreversible";
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  isIdempotent: boolean;
  timeout_ms?: number;
}

export interface MCPPermissionSummary {
  defaultPolicy: "allow" | "deny";
  agentCapabilities: Array<{
    actionName: string;
    policy: string;
    allowedEnvironments: string[];
    maxExecutionsPerHour?: number;
    maxExecutionsPerDay?: number;
  }>;
  rolePermissions: Array<{
    role: string;
    allowedActions: string[];
  }>;
}

export interface MCPManifest {
  version: string;
  versionNumber: number;
  name: string;
  description?: string;
  serverUrl: string;
  authMethod: string;
  authConfig?: Record<string, unknown>;
  tools: MCPTool[];
  permissions: MCPPermissionSummary;
  createdAt: string;
  changelog?: string;
  checksum?: string;
}

export interface MCPExport {
  id: string;
  projectId: string;
  version: string;
  versionNumber: number;
  format: string;
  manifest: MCPManifest;
  isLatest: boolean;
  releaseNotes?: string;
  createdAt: string;
  exportedBy?: string;
  fileSizeBytes?: number;
  checksum?: string;
}

interface UseExportOptions {
  projectId: string | null;
}

export function useExport({ projectId }: UseExportOptions) {
  const [exports, setExports] = useState<MCPExport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchExports = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("mcp_exports")
        .select("*")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

      if (error) throw error;

      setExports(
        (data || []).map((e) => ({
          id: e.id,
          projectId: e.project_id,
          version: e.version,
          versionNumber: e.version_number,
          format: e.format,
          manifest: e.mcp_manifest as unknown as MCPManifest,
          isLatest: e.is_latest,
          releaseNotes: e.release_notes ?? undefined,
          createdAt: e.created_at,
          exportedBy: e.exported_by ?? undefined,
          fileSizeBytes: e.file_size_bytes ?? undefined,
          checksum: e.checksum ?? undefined,
        }))
      );
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch exports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  const getLatestExport = useCallback(async (): Promise<MCPExport | null> => {
    if (!projectId) return null;

    const { data, error } = await supabase
      .from("mcp_exports")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_latest", true)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      projectId: data.project_id,
      version: data.version,
      versionNumber: data.version_number,
      format: data.format,
      manifest: data.mcp_manifest as unknown as MCPManifest,
      isLatest: data.is_latest,
      releaseNotes: data.release_notes ?? undefined,
      createdAt: data.created_at,
      exportedBy: data.exported_by ?? undefined,
      fileSizeBytes: data.file_size_bytes ?? undefined,
      checksum: data.checksum ?? undefined,
    };
  }, [projectId]);

  const generateExport = useCallback(
    async (options: {
      releaseNotes?: string;
      includeAuth?: boolean;
      includeSchemas?: boolean;
    }): Promise<MCPExport | null> => {
      if (!projectId || !user) {
        toast({
          title: "Error",
          description: "Project or user not available",
          variant: "destructive",
        });
        return null;
      }

      try {
        setGenerating(true);

        // Fetch project details
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (projectError || !project) throw new Error("Project not found");

        // Fetch action templates
        const { data: actions, error: actionsError } = await supabase
          .from("action_templates")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_enabled", true)
          .eq("status", "active");

        if (actionsError) throw actionsError;

        // Fetch agent capabilities
        const { data: capabilities, error: capError } = await supabase
          .from("agent_capabilities")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true);

        if (capError) throw capError;

        // Fetch connectors for auth info
        const { data: connectors, error: connError } = await supabase
          .from("api_connectors")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .limit(1);

        if (connError) throw connError;

        const primaryConnector = connectors?.[0];

        // Build tools array
        const tools: MCPTool[] = (actions || []).map((action) => {
          const capability = capabilities?.find(
            (c) => c.action_template_id === action.id || c.action_name === action.name
          );

          return {
            name: action.name,
            description: action.description,
            inputSchema: options.includeSchemas
              ? (action.input_schema as Record<string, unknown>) || {}
              : { type: "object" },
            outputSchema: options.includeSchemas
              ? (action.output_schema as Record<string, unknown>) || undefined
              : undefined,
            examples: (action.examples as MCPTool["examples"]) || [],
            riskLevel: action.risk_level as MCPTool["riskLevel"],
            requiresConfirmation:
              capability?.policy === "require_confirmation" || false,
            requiresApproval:
              action.requires_approval || capability?.policy === "require_approval",
            isIdempotent: action.is_idempotent,
            timeout_ms: action.timeout_ms ?? undefined,
          };
        });

        // Build permission summary
        const permissions: MCPPermissionSummary = {
          defaultPolicy: "deny",
          agentCapabilities: (capabilities || []).map((c) => ({
            actionName: c.action_name || "unknown",
            policy: c.policy,
            allowedEnvironments: (c.allowed_environments || []) as string[],
            maxExecutionsPerHour: c.max_executions_per_hour ?? undefined,
            maxExecutionsPerDay: c.max_executions_per_day ?? undefined,
          })),
          rolePermissions: [
            { role: "owner", allowedActions: ["*"] },
            { role: "admin", allowedActions: ["*"] },
            { role: "member", allowedActions: ["read", "execute"] },
            { role: "viewer", allowedActions: ["read"] },
          ],
        };

        // Get next version number
        const { data: latestExport } = await supabase
          .from("mcp_exports")
          .select("version_number")
          .eq("project_id", projectId)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        const nextVersionNumber = (latestExport?.version_number || 0) + 1;
        const version = `${nextVersionNumber}.0.0`;

        // Build manifest
        const manifest: MCPManifest = {
          version,
          versionNumber: nextVersionNumber,
          name: project.name,
          description: project.description ?? undefined,
          serverUrl: primaryConnector?.base_url || "",
          authMethod: options.includeAuth
            ? primaryConnector?.auth_type || "none"
            : "none",
          authConfig: options.includeAuth
            ? (primaryConnector?.auth_config as Record<string, unknown>) || undefined
            : undefined,
          tools,
          permissions,
          createdAt: new Date().toISOString(),
          changelog: options.releaseNotes,
        };

        // Calculate checksum
        const manifestString = JSON.stringify(manifest);
        const checksum = await generateChecksum(manifestString);
        manifest.checksum = checksum;

        // Mark previous latest as not latest
        await supabase
          .from("mcp_exports")
          .update({ is_latest: false })
          .eq("project_id", projectId)
          .eq("is_latest", true);

        // Insert new export
        const { data: newExport, error: insertError } = await supabase
          .from("mcp_exports")
          .insert({
            project_id: projectId,
            version,
            version_number: nextVersionNumber,
            format: "json",
            mcp_manifest: manifest as unknown as Json,
            is_latest: true,
            release_notes: options.releaseNotes || null,
            exported_by: user.id,
            file_size_bytes: new Blob([manifestString]).size,
            checksum,
            included_actions: tools.map((t) => t.name),
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast({
          title: "Export generated",
          description: `Version ${version} created successfully`,
        });

        await fetchExports();

        return {
          id: newExport.id,
          projectId: newExport.project_id,
          version: newExport.version,
          versionNumber: newExport.version_number,
          format: newExport.format,
          manifest,
          isLatest: newExport.is_latest,
          releaseNotes: newExport.release_notes ?? undefined,
          createdAt: newExport.created_at,
          exportedBy: newExport.exported_by ?? undefined,
          fileSizeBytes: newExport.file_size_bytes ?? undefined,
          checksum: newExport.checksum ?? undefined,
        };
      } catch (err) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Failed to generate export",
          variant: "destructive",
        });
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [projectId, user, toast, fetchExports]
  );

  const downloadExport = useCallback(
    (exportData: MCPExport, format: "json" | "yaml" = "json") => {
      const content =
        format === "json"
          ? JSON.stringify(exportData.manifest, null, 2)
          : jsonToYaml(exportData.manifest);

      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/yaml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcp-${exportData.manifest.name}-v${exportData.version}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: `${format.toUpperCase()} file downloaded`,
      });
    },
    [toast]
  );

  const copyToClipboard = useCallback(
    async (exportData: MCPExport, format: "json" | "yaml" = "json") => {
      const content =
        format === "json"
          ? JSON.stringify(exportData.manifest, null, 2)
          : jsonToYaml(exportData.manifest);

      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied",
        description: `${format.toUpperCase()} copied to clipboard`,
      });
    },
    [toast]
  );

  const getApiEndpoint = useCallback(
    (version?: string) => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const endpoint = `${baseUrl}/functions/v1/get-mcp-export?project_id=${projectId}`;
      return version ? `${endpoint}&version=${version}` : endpoint;
    },
    [projectId]
  );

  return {
    exports,
    loading,
    generating,
    fetchExports,
    getLatestExport,
    generateExport,
    downloadExport,
    copyToClipboard,
    getApiEndpoint,
  };
}

// Helper: Generate SHA-256 checksum
async function generateChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Convert JSON to YAML (simple implementation)
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = "  ".repeat(indent);

  if (obj === null || obj === undefined) {
    return "null";
  }

  if (typeof obj === "string") {
    if (obj.includes("\n") || obj.includes(":") || obj.includes("#")) {
      return `|\n${obj
        .split("\n")
        .map((line) => spaces + "  " + line)
        .join("\n")}`;
    }
    return obj;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        const value = jsonToYaml(item, indent + 1);
        if (typeof item === "object" && item !== null) {
          return `${spaces}- ${value.trim().replace(/^\s+/, "")}`;
        }
        return `${spaces}- ${value}`;
      })
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, value]) => {
        const yamlValue = jsonToYaml(value, indent + 1);
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${yamlValue}`;
        }
        if (Array.isArray(value) && value.length > 0) {
          return `${spaces}${key}:\n${yamlValue}`;
        }
        return `${spaces}${key}: ${yamlValue}`;
      })
      .join("\n");
  }

  return String(obj);
}
