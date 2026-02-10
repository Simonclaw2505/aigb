/**
 * Hook for managing agent API keys
 * CRUD operations for API keys used by AI agents to authenticate
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface AgentApiKey {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  permissions: Record<string, unknown>;
  rateLimitPerHour: number | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface UseAgentApiKeysOptions {
  organizationId: string | null;
}

// Generate a random API key with mcpf_ prefix
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mcpf_";
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// SHA-256 hash
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAgentApiKeys({ organizationId }: UseAgentApiKeysOptions) {
  const [keys, setKeys] = useState<AgentApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchKeys = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setKeys(
        (data || []).map((k) => ({
          id: k.id,
          projectId: k.project_id,
          organizationId: k.organization_id,
          name: k.name,
          keyPrefix: k.key_prefix,
          permissions: (k.permissions || {}) as Record<string, unknown>,
          rateLimitPerHour: k.rate_limit_per_hour,
          expiresAt: k.expires_at,
          lastUsedAt: k.last_used_at,
          usageCount: k.usage_count,
          isActive: k.is_active,
          createdBy: k.created_by,
          createdAt: k.created_at,
        }))
      );
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch API keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  const createKey = useCallback(
    async (params: {
      projectId: string;
      name: string;
      rateLimitPerHour?: number;
      expiresAt?: string;
    }): Promise<{ key: AgentApiKey; rawKey: string } | null> => {
      if (!organizationId || !user) return null;

      try {
        const rawKey = generateApiKey();
        const keyHash = await hashKey(rawKey);
        const keyPrefix = rawKey.slice(0, 12); // "mcpf_" + 7 chars

        const { data, error } = await supabase
          .from("agent_api_keys")
          .insert({
            project_id: params.projectId,
            organization_id: organizationId,
            name: params.name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            rate_limit_per_hour: params.rateLimitPerHour || null,
            expires_at: params.expiresAt || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "API Key created",
          description: "Copy the key now — it won't be shown again",
        });

        await fetchKeys();

        return {
          key: {
            id: data.id,
            projectId: data.project_id,
            organizationId: data.organization_id,
            name: data.name,
            keyPrefix: data.key_prefix,
            permissions: (data.permissions || {}) as Record<string, unknown>,
            rateLimitPerHour: data.rate_limit_per_hour,
            expiresAt: data.expires_at,
            lastUsedAt: data.last_used_at,
            usageCount: data.usage_count,
            isActive: data.is_active,
            createdBy: data.created_by,
            createdAt: data.created_at,
          },
          rawKey,
        };
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to create API key",
          variant: "destructive",
        });
        return null;
      }
    },
    [organizationId, user, toast, fetchKeys]
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      try {
        const { error } = await supabase
          .from("agent_api_keys")
          .update({ is_active: false })
          .eq("id", keyId);

        if (error) throw error;

        toast({ title: "API Key revoked" });
        await fetchKeys();
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to revoke key",
          variant: "destructive",
        });
      }
    },
    [toast, fetchKeys]
  );

  const deleteKey = useCallback(
    async (keyId: string) => {
      try {
        const { error } = await supabase
          .from("agent_api_keys")
          .delete()
          .eq("id", keyId);

        if (error) throw error;

        toast({ title: "API Key deleted" });
        await fetchKeys();
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to delete key",
          variant: "destructive",
        });
      }
    },
    [toast, fetchKeys]
  );

  return { keys, loading, fetchKeys, createKey, revokeKey, deleteKey };
}
