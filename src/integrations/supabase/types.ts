export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_permissions: {
        Row: {
          action_id: string
          can_execute: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action_id: string
          can_execute?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action_id?: string
          can_execute?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "action_permissions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "api_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_templates: {
        Row: {
          agent_policy: Database["public"]["Enums"]["agent_capability_policy"]
          allowed_environments: Database["public"]["Enums"]["environment_type"][]
          approval_roles: Database["public"]["Enums"]["app_role"][]
          auto_generated: boolean
          constraints: Json | null
          created_at: string
          created_by: string | null
          description: string
          endpoint_id: string | null
          endpoint_method: string | null
          endpoint_path: string | null
          examples: Json | null
          id: string
          idempotency_key_path: string | null
          input_schema: Json
          is_enabled: boolean
          is_idempotent: boolean
          is_reversible: boolean
          max_executions_per_day: number | null
          max_executions_per_hour: number | null
          name: string
          output_schema: Json | null
          project_id: string
          rate_limit_requests: number | null
          rate_limit_window_seconds: number | null
          requires_approval: boolean
          retry_config: Json | null
          risk_level: Database["public"]["Enums"]["action_risk_level"]
          rollback_config: Json | null
          status: Database["public"]["Enums"]["resource_status"]
          timeout_ms: number | null
          updated_at: string
          version: number
        }
        Insert: {
          agent_policy?: Database["public"]["Enums"]["agent_capability_policy"]
          allowed_environments?: Database["public"]["Enums"]["environment_type"][]
          approval_roles?: Database["public"]["Enums"]["app_role"][]
          auto_generated?: boolean
          constraints?: Json | null
          created_at?: string
          created_by?: string | null
          description: string
          endpoint_id?: string | null
          endpoint_method?: string | null
          endpoint_path?: string | null
          examples?: Json | null
          id?: string
          idempotency_key_path?: string | null
          input_schema: Json
          is_enabled?: boolean
          is_idempotent?: boolean
          is_reversible?: boolean
          max_executions_per_day?: number | null
          max_executions_per_hour?: number | null
          name: string
          output_schema?: Json | null
          project_id: string
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          requires_approval?: boolean
          retry_config?: Json | null
          risk_level?: Database["public"]["Enums"]["action_risk_level"]
          rollback_config?: Json | null
          status?: Database["public"]["Enums"]["resource_status"]
          timeout_ms?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          agent_policy?: Database["public"]["Enums"]["agent_capability_policy"]
          allowed_environments?: Database["public"]["Enums"]["environment_type"][]
          approval_roles?: Database["public"]["Enums"]["app_role"][]
          auto_generated?: boolean
          constraints?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string
          endpoint_id?: string | null
          endpoint_method?: string | null
          endpoint_path?: string | null
          examples?: Json | null
          id?: string
          idempotency_key_path?: string | null
          input_schema?: Json
          is_enabled?: boolean
          is_idempotent?: boolean
          is_reversible?: boolean
          max_executions_per_day?: number | null
          max_executions_per_hour?: number | null
          name?: string
          output_schema?: Json | null
          project_id?: string
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          requires_approval?: boolean
          retry_config?: Json | null
          risk_level?: Database["public"]["Enums"]["action_risk_level"]
          rollback_config?: Json | null
          status?: Database["public"]["Enums"]["resource_status"]
          timeout_ms?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "action_templates_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          permissions: Json | null
          project_id: string
          rate_limit_per_hour: number | null
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          permissions?: Json | null
          project_id: string
          rate_limit_per_hour?: number | null
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          permissions?: Json | null
          project_id?: string
          rate_limit_per_hour?: number | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_capabilities: {
        Row: {
          action_name: string | null
          action_template_id: string | null
          allowed_environments:
            | Database["public"]["Enums"]["environment_type"][]
            | null
          approval_roles: Database["public"]["Enums"]["app_role"][] | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          max_executions_per_day: number | null
          max_executions_per_hour: number | null
          policy: Database["public"]["Enums"]["agent_capability_policy"]
          project_id: string
          updated_at: string
        }
        Insert: {
          action_name?: string | null
          action_template_id?: string | null
          allowed_environments?:
            | Database["public"]["Enums"]["environment_type"][]
            | null
          approval_roles?: Database["public"]["Enums"]["app_role"][] | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_executions_per_day?: number | null
          max_executions_per_hour?: number | null
          policy?: Database["public"]["Enums"]["agent_capability_policy"]
          project_id: string
          updated_at?: string
        }
        Update: {
          action_name?: string | null
          action_template_id?: string | null
          allowed_environments?:
            | Database["public"]["Enums"]["environment_type"][]
            | null
          approval_roles?: Database["public"]["Enums"]["app_role"][] | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_executions_per_day?: number | null
          max_executions_per_hour?: number | null
          policy?: Database["public"]["Enums"]["agent_capability_policy"]
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capabilities_action_template_id_fkey"
            columns: ["action_template_id"]
            isOneToOne: false
            referencedRelation: "action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_capabilities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_members: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          agent_id: string
          api_source_id: string
          created_at: string
          id: string
        }
        Insert: {
          agent_id: string
          api_source_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agent_id?: string
          api_source_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tools_api_source_id_fkey"
            columns: ["api_source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_actions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          method: string
          name: string
          parameters: Json | null
          path: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          method: string
          name: string
          parameters?: Json | null
          path: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          method?: string
          name?: string
          parameters?: Json | null
          path?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_connectors: {
        Row: {
          api_source_id: string | null
          auth_config: Json | null
          auth_type: string
          base_url: string
          created_at: string
          created_by: string | null
          credential_secret_id: string | null
          default_headers: Json | null
          description: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_used_at: string | null
          name: string
          oauth_refresh_secret_id: string | null
          organization_id: string
          project_id: string | null
          rate_limit_requests: number | null
          rate_limit_window_seconds: number | null
          retry_config: Json | null
          timeout_ms: number | null
          updated_at: string
        }
        Insert: {
          api_source_id?: string | null
          auth_config?: Json | null
          auth_type?: string
          base_url: string
          created_at?: string
          created_by?: string | null
          credential_secret_id?: string | null
          default_headers?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          name: string
          oauth_refresh_secret_id?: string | null
          organization_id: string
          project_id?: string | null
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          retry_config?: Json | null
          timeout_ms?: number | null
          updated_at?: string
        }
        Update: {
          api_source_id?: string | null
          auth_config?: Json | null
          auth_type?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          credential_secret_id?: string | null
          default_headers?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          name?: string
          oauth_refresh_secret_id?: string | null
          organization_id?: string
          project_id?: string | null
          rate_limit_requests?: number | null
          rate_limit_window_seconds?: number | null
          retry_config?: Json | null
          timeout_ms?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_connectors_api_source_id_fkey"
            columns: ["api_source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_connectors_credential_secret_id_fkey"
            columns: ["credential_secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_connectors_oauth_refresh_secret_id_fkey"
            columns: ["oauth_refresh_secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_connectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_connectors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_sources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          parsed_at: string | null
          project_id: string | null
          source_type: Database["public"]["Enums"]["api_source_type"]
          spec_content: Json | null
          spec_hash: string | null
          spec_url: string | null
          status: Database["public"]["Enums"]["resource_status"]
          updated_at: string
          validation_errors: Json | null
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          parsed_at?: string | null
          project_id?: string | null
          source_type?: Database["public"]["Enums"]["api_source_type"]
          spec_content?: Json | null
          spec_hash?: string | null
          spec_url?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          updated_at?: string
          validation_errors?: Json | null
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          parsed_at?: string | null
          project_id?: string | null
          source_type?: Database["public"]["Enums"]["api_source_type"]
          spec_content?: Json | null
          spec_hash?: string | null
          spec_url?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          updated_at?: string
          validation_errors?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_policies: {
        Row: {
          approver_roles: Database["public"]["Enums"]["app_role"][]
          approver_users: string[] | null
          auto_reject_on_timeout: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          notification_channels: Json | null
          organization_id: string
          required_approvals: number
          timeout_hours: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          approver_roles: Database["public"]["Enums"]["app_role"][]
          approver_users?: string[] | null
          auto_reject_on_timeout?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notification_channels?: Json | null
          organization_id: string
          required_approvals?: number
          timeout_hours?: number | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          approver_roles?: Database["public"]["Enums"]["app_role"][]
          approver_users?: string[] | null
          auto_reject_on_timeout?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_channels?: Json | null
          organization_id?: string
          required_approvals?: number
          timeout_hours?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          action_type: string
          approvals: Json | null
          created_at: string
          expires_at: string | null
          id: string
          organization_id: string
          policy_id: string
          rejections: Json | null
          request_data: Json | null
          requested_by: string | null
          resolved_at: string | null
          resource_id: string
          resource_type: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          action_type: string
          approvals?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id: string
          policy_id: string
          rejections?: Json | null
          request_data?: Json | null
          requested_by?: string | null
          resolved_at?: string | null
          resource_id: string
          resource_type: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          action_type?: string
          approvals?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          policy_id?: string
          rejections?: Json | null
          request_data?: Json | null
          requested_by?: string | null
          resolved_at?: string | null
          resource_id?: string
          resource_type?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "approval_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      endpoints: {
        Row: {
          api_source_id: string
          created_at: string
          description: string | null
          header_parameters: Json | null
          id: string
          is_deprecated: boolean
          method: Database["public"]["Enums"]["http_method"]
          name: string
          operation_id: string | null
          path: string
          path_parameters: Json | null
          query_parameters: Json | null
          request_body_schema: Json | null
          response_schemas: Json | null
          status: Database["public"]["Enums"]["resource_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          api_source_id: string
          created_at?: string
          description?: string | null
          header_parameters?: Json | null
          id?: string
          is_deprecated?: boolean
          method: Database["public"]["Enums"]["http_method"]
          name: string
          operation_id?: string | null
          path: string
          path_parameters?: Json | null
          query_parameters?: Json | null
          request_body_schema?: Json | null
          response_schemas?: Json | null
          status?: Database["public"]["Enums"]["resource_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          api_source_id?: string
          created_at?: string
          description?: string | null
          header_parameters?: Json | null
          id?: string
          is_deprecated?: boolean
          method?: Database["public"]["Enums"]["http_method"]
          name?: string
          operation_id?: string | null
          path?: string
          path_parameters?: Json | null
          query_parameters?: Json | null
          request_body_schema?: Json | null
          response_schemas?: Json | null
          status?: Database["public"]["Enums"]["resource_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "endpoints_api_source_id_fkey"
            columns: ["api_source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_configs: {
        Row: {
          base_url: string | null
          created_at: string
          created_by: string | null
          default_headers: Json | null
          default_timeout_ms: number | null
          environment: Database["public"]["Enums"]["environment_type"]
          features: Json | null
          global_rate_limit_requests: number | null
          global_rate_limit_window_seconds: number | null
          id: string
          is_active: boolean
          log_level: string | null
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          default_headers?: Json | null
          default_timeout_ms?: number | null
          environment: Database["public"]["Enums"]["environment_type"]
          features?: Json | null
          global_rate_limit_requests?: number | null
          global_rate_limit_window_seconds?: number | null
          id?: string
          is_active?: boolean
          log_level?: string | null
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          default_headers?: Json | null
          default_timeout_ms?: number | null
          environment?: Database["public"]["Enums"]["environment_type"]
          features?: Json | null
          global_rate_limit_requests?: number | null
          global_rate_limit_window_seconds?: number | null
          id?: string
          is_active?: boolean
          log_level?: string | null
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environment_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_runs: {
        Row: {
          action_template_id: string | null
          agent_session_id: string | null
          approval_request_id: string | null
          attempt_number: number
          completed_at: string | null
          connector_id: string | null
          created_at: string
          diff_summary: Json | null
          duration_ms: number | null
          environment: Database["public"]["Enums"]["environment_type"]
          error_details: Json | null
          error_message: string | null
          headers_sent: Json | null
          id: string
          idempotency_key: string | null
          input_parameters: Json | null
          ip_address: unknown
          is_rollback: boolean
          organization_id: string
          original_execution_id: string | null
          output_data: Json | null
          project_id: string
          redacted_request: Json | null
          redacted_response: Json | null
          request_metadata: Json | null
          response_metadata: Json | null
          retry_count: number | null
          rollback_execution_id: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["execution_status"]
          triggered_by: string
          triggered_by_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_template_id?: string | null
          agent_session_id?: string | null
          approval_request_id?: string | null
          attempt_number?: number
          completed_at?: string | null
          connector_id?: string | null
          created_at?: string
          diff_summary?: Json | null
          duration_ms?: number | null
          environment?: Database["public"]["Enums"]["environment_type"]
          error_details?: Json | null
          error_message?: string | null
          headers_sent?: Json | null
          id?: string
          idempotency_key?: string | null
          input_parameters?: Json | null
          ip_address?: unknown
          is_rollback?: boolean
          organization_id: string
          original_execution_id?: string | null
          output_data?: Json | null
          project_id: string
          redacted_request?: Json | null
          redacted_response?: Json | null
          request_metadata?: Json | null
          response_metadata?: Json | null
          retry_count?: number | null
          rollback_execution_id?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          triggered_by: string
          triggered_by_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_template_id?: string | null
          agent_session_id?: string | null
          approval_request_id?: string | null
          attempt_number?: number
          completed_at?: string | null
          connector_id?: string | null
          created_at?: string
          diff_summary?: Json | null
          duration_ms?: number | null
          environment?: Database["public"]["Enums"]["environment_type"]
          error_details?: Json | null
          error_message?: string | null
          headers_sent?: Json | null
          id?: string
          idempotency_key?: string | null
          input_parameters?: Json | null
          ip_address?: unknown
          is_rollback?: boolean
          organization_id?: string
          original_execution_id?: string | null
          output_data?: Json | null
          project_id?: string
          redacted_request?: Json | null
          redacted_response?: Json | null
          request_metadata?: Json | null
          response_metadata?: Json | null
          retry_count?: number | null
          rollback_execution_id?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          triggered_by?: string
          triggered_by_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_runs_action_template_id_fkey"
            columns: ["action_template_id"]
            isOneToOne: false
            referencedRelation: "action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "api_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_original_execution_id_fkey"
            columns: ["original_execution_id"]
            isOneToOne: false
            referencedRelation: "execution_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_rollback_execution_id_fkey"
            columns: ["rollback_execution_id"]
            isOneToOne: false
            referencedRelation: "execution_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_exports: {
        Row: {
          checksum: string | null
          created_at: string
          exported_by: string | null
          file_size_bytes: number | null
          format: string
          id: string
          included_actions: string[] | null
          is_latest: boolean
          mcp_manifest: Json
          project_id: string
          release_notes: string | null
          status: Database["public"]["Enums"]["resource_status"]
          version: string
          version_number: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          exported_by?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          included_actions?: string[] | null
          is_latest?: boolean
          mcp_manifest: Json
          project_id: string
          release_notes?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          version: string
          version_number: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          exported_by?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          included_actions?: string[] | null
          is_latest?: boolean
          mcp_manifest?: Json
          project_id?: string
          release_notes?: string | null
          status?: Database["public"]["Enums"]["resource_status"]
          version?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcp_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permission_evaluations: {
        Row: {
          action_template_id: string | null
          agent_session_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          evaluated_at: string
          evaluation_details: Json | null
          evaluation_result: Database["public"]["Enums"]["policy_effect"]
          id: string
          ip_address: unknown
          matched_rules: string[] | null
          organization_id: string
          requested_action: string
          requires_approval: boolean | null
          requires_confirmation: boolean | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_template_id?: string | null
          agent_session_id?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          evaluated_at?: string
          evaluation_details?: Json | null
          evaluation_result: Database["public"]["Enums"]["policy_effect"]
          id?: string
          ip_address?: unknown
          matched_rules?: string[] | null
          organization_id: string
          requested_action: string
          requires_approval?: boolean | null
          requires_confirmation?: boolean | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_template_id?: string | null
          agent_session_id?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          evaluated_at?: string
          evaluation_details?: Json | null
          evaluation_result?: Database["public"]["Enums"]["policy_effect"]
          id?: string
          ip_address?: unknown
          matched_rules?: string[] | null
          organization_id?: string
          requested_action?: string
          requires_approval?: boolean | null
          requires_confirmation?: boolean | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_evaluations_action_template_id_fkey"
            columns: ["action_template_id"]
            isOneToOne: false
            referencedRelation: "action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_policies: {
        Row: {
          allowed_actions: string[]
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          effect: Database["public"]["Enums"]["policy_effect"]
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: number
          resource_id: string | null
          resource_type: string
          subject_id: string | null
          subject_role: Database["public"]["Enums"]["app_role"] | null
          subject_type: string
          updated_at: string
        }
        Insert: {
          allowed_actions: string[]
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effect?: Database["public"]["Enums"]["policy_effect"]
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          priority?: number
          resource_id?: string | null
          resource_type: string
          subject_id?: string | null
          subject_role?: Database["public"]["Enums"]["app_role"] | null
          subject_type: string
          updated_at?: string
        }
        Update: {
          allowed_actions?: string[]
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effect?: Database["public"]["Enums"]["policy_effect"]
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: number
          resource_id?: string | null
          resource_type?: string
          subject_id?: string | null
          subject_role?: Database["public"]["Enums"]["app_role"] | null
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_attempt_logs: {
        Row: {
          attempted_at: string
          id: string
          ip_address: unknown
          organization_id: string
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address?: unknown
          organization_id: string
          success?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_attempt_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          mcp_config: Json | null
          name: string
          openapi_spec: Json | null
          organization_id: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mcp_config?: Json | null
          name: string
          openapi_spec?: Json | null
          organization_id: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mcp_config?: Json | null
          name?: string
          openapi_spec?: Json | null
          organization_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          company: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          message: string | null
          phone: string | null
          type: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          job_title?: string | null
          last_name: string
          message?: string | null
          phone?: string | null
          type: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          message?: string | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      secrets: {
        Row: {
          access_count: number
          created_at: string
          created_by: string | null
          description: string | null
          encrypted_value: string
          environment: Database["public"]["Enums"]["environment_type"] | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          last_rotated_at: string | null
          name: string
          organization_id: string
          previous_version_id: string | null
          project_id: string | null
          rotation_reminder_days: number | null
          updated_at: string
          version: number
        }
        Insert: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          encrypted_value: string
          environment?: Database["public"]["Enums"]["environment_type"] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_rotated_at?: string | null
          name: string
          organization_id: string
          previous_version_id?: string | null
          project_id?: string | null
          rotation_reminder_days?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          encrypted_value?: string
          environment?: Database["public"]["Enums"]["environment_type"] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_rotated_at?: string | null
          name?: string
          organization_id?: string
          previous_version_id?: string | null
          project_id?: string | null
          rotation_reminder_days?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "secrets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secrets_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secrets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_library: {
        Row: {
          auth_header_name: string | null
          auth_instructions: string | null
          auth_type: string
          base_url: string
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          endpoints: Json | null
          extra_headers: Json | null
          id: string
          is_published: boolean | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          auth_header_name?: string | null
          auth_instructions?: string | null
          auth_type?: string
          base_url: string
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          endpoints?: Json | null
          extra_headers?: Json | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          auth_header_name?: string | null
          auth_instructions?: string | null
          auth_type?: string
          base_url?: string
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          endpoints?: Json | null
          extra_headers?: Json | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permission_rules: {
        Row: {
          action: string
          agent_id: string | null
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          effect: Database["public"]["Enums"]["policy_effect"]
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: number
          resource_id: string | null
          resource_type: string
          subject_role: Database["public"]["Enums"]["app_role"] | null
          subject_user_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          agent_id?: string | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effect?: Database["public"]["Enums"]["policy_effect"]
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          priority?: number
          resource_id?: string | null
          resource_type: string
          subject_role?: Database["public"]["Enums"]["app_role"] | null
          subject_user_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          agent_id?: string | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effect?: Database["public"]["Enums"]["policy_effect"]
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: number
          resource_id?: string | null
          resource_type?: string
          subject_role?: Database["public"]["Enums"]["app_role"] | null
          subject_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_endpoint: {
        Args: { _endpoint_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      create_organization_with_membership: {
        Args: { org_name: string; org_slug: string }
        Returns: string
      }
      evaluate_permission: {
        Args: {
          _action: string
          _context?: Json
          _organization_id: string
          _resource_id: string
          _resource_type: string
          _user_id: string
        }
        Returns: {
          allowed: boolean
          denial_reason: string
          matched_rule_ids: string[]
          requires_approval: boolean
          requires_confirmation: boolean
        }[]
      }
      get_agent_role: {
        Args: { _agent_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_project_org_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_security_pin: { Args: { pin: string }; Returns: string }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      verify_security_pin: {
        Args: { pin: string; stored_hash: string }
        Returns: boolean
      }
    }
    Enums: {
      action_risk_level:
        | "read_only"
        | "safe_write"
        | "risky_write"
        | "irreversible"
      agent_capability_policy:
        | "allow"
        | "deny"
        | "require_confirmation"
        | "require_approval"
      api_source_type: "openapi" | "swagger" | "graphql" | "grpc" | "manual"
      app_role: "owner" | "admin" | "member" | "viewer"
      approval_status: "pending" | "approved" | "rejected" | "expired"
      environment_type: "development" | "staging" | "production"
      execution_status:
        | "pending"
        | "running"
        | "success"
        | "failed"
        | "timeout"
        | "cancelled"
      http_method:
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE"
        | "HEAD"
        | "OPTIONS"
      policy_effect: "allow" | "deny"
      project_status: "draft" | "active" | "archived"
      resource_status: "pending" | "active" | "disabled" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_risk_level: [
        "read_only",
        "safe_write",
        "risky_write",
        "irreversible",
      ],
      agent_capability_policy: [
        "allow",
        "deny",
        "require_confirmation",
        "require_approval",
      ],
      api_source_type: ["openapi", "swagger", "graphql", "grpc", "manual"],
      app_role: ["owner", "admin", "member", "viewer"],
      approval_status: ["pending", "approved", "rejected", "expired"],
      environment_type: ["development", "staging", "production"],
      execution_status: [
        "pending",
        "running",
        "success",
        "failed",
        "timeout",
        "cancelled",
      ],
      http_method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      policy_effect: ["allow", "deny"],
      project_status: ["draft", "active", "archived"],
      resource_status: ["pending", "active", "disabled", "archived"],
    },
  },
} as const
