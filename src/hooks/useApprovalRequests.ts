/**
 * Hook for managing approval requests in the Simulator
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  requested_by: string | null;
  approvals: unknown[];
  rejections: unknown[];
  resource_id: string;
  action_type: string;
}

interface UseApprovalRequestsOptions {
  organizationId: string | null;
  projectId: string | null;
}

export function useApprovalRequests({ organizationId, projectId }: UseApprovalRequestsOptions) {
  const { toast } = useToast();
  const [approvalRequests, setApprovalRequests] = useState<Map<string, ApprovalRequest>>(new Map());
  const [loading, setLoading] = useState(false);

  // Create a new approval request for a step
  const createApprovalRequest = useCallback(async (
    stepNumber: number,
    actionTemplateId: string,
    actionName: string,
    sessionId: string
  ): Promise<ApprovalRequest | null> => {
    if (!organizationId || !projectId) {
      toast({
        title: "Error",
        description: "Missing organization or project context",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);
    try {
      // First, find or create a default approval policy
      let policyId: string;
      
      const { data: existingPolicies } = await supabase
        .from("approval_policies")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .limit(1);

      if (existingPolicies && existingPolicies.length > 0) {
        policyId = existingPolicies[0].id;
      } else {
        // Create a default policy
        const { data: newPolicy, error: policyError } = await supabase
          .from("approval_policies")
          .insert({
            organization_id: organizationId,
            name: "Default Approval Policy",
            description: "Auto-created policy for simulator approvals",
            trigger_type: "action_execution",
            trigger_config: { actions: ["*"] },
            approver_roles: ["owner", "admin"],
            required_approvals: 1,
          })
          .select("id")
          .single();

        if (policyError) throw policyError;
        policyId = newPolicy.id;
      }

      // Create the approval request
      const { data: request, error } = await supabase
        .from("approval_requests")
        .insert({
          organization_id: organizationId,
          policy_id: policyId,
          resource_type: "action_execution",
          resource_id: actionTemplateId,
          action_type: actionName,
          request_data: {
            session_id: sessionId,
            step_number: stepNumber,
            project_id: projectId,
          },
          status: "pending",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select()
        .single();

      if (error) throw error;

      const approvalRequest: ApprovalRequest = {
        id: request.id,
        status: request.status as ApprovalRequest["status"],
        created_at: request.created_at,
        requested_by: request.requested_by,
        approvals: (request.approvals as unknown[]) || [],
        rejections: (request.rejections as unknown[]) || [],
        resource_id: request.resource_id,
        action_type: request.action_type,
      };

      // Store in local state
      setApprovalRequests((prev) => {
        const next = new Map(prev);
        next.set(`${stepNumber}`, approvalRequest);
        return next;
      });

      toast({
        title: "Approval Requested",
        description: `Approval request created for ${actionName}`,
      });

      return approvalRequest;
    } catch (err) {
      console.error("Failed to create approval request:", err);
      toast({
        title: "Error",
        description: "Failed to create approval request",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [organizationId, projectId, toast]);

  // Approve a request
  const approveRequest = useCallback(async (
    stepNumber: number,
    userId: string,
    operator?: { operator_id: string; operator_name: string; role: string }
  ): Promise<boolean> => {
    const request = approvalRequests.get(`${stepNumber}`);
    if (!request) return false;

    setLoading(true);
    try {
      const currentApprovals = Array.isArray(request.approvals) ? request.approvals : [];
      const newApproval = {
        user_id: userId,
        approved_at: new Date().toISOString(),
        ...(operator
          ? {
              operator_id: operator.operator_id,
              operator_name: operator.operator_name,
              operator_role: operator.role,
            }
          : {}),
      };

      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          approvals: [...currentApprovals, newApproval] as unknown as null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      setApprovalRequests((prev) => {
        const next = new Map(prev);
        const updated = { ...request, status: "approved" as const, approvals: [...request.approvals, newApproval] };
        next.set(`${stepNumber}`, updated);
        return next;
      });

      toast({
        title: "Approuvé",
        description: operator
          ? `Validé par ${operator.operator_name} (${operator.role})`
          : "Action approuvée",
      });

      return true;
    } catch (err) {
      console.error("Failed to approve request:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'approuver la demande",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [approvalRequests, toast]);

  // Reject a request
  const rejectRequest = useCallback(async (
    stepNumber: number,
    userId: string,
    reason?: string,
    operator?: { operator_id: string; operator_name: string; role: string }
  ): Promise<boolean> => {
    const request = approvalRequests.get(`${stepNumber}`);
    if (!request) return false;

    setLoading(true);
    try {
      const currentRejections = Array.isArray(request.rejections) ? request.rejections : [];
      const newRejection = {
        user_id: userId,
        rejected_at: new Date().toISOString(),
        reason,
        ...(operator
          ? {
              operator_id: operator.operator_id,
              operator_name: operator.operator_name,
              operator_role: operator.role,
            }
          : {}),
      };

      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "rejected",
          rejections: [...currentRejections, newRejection] as unknown as null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      setApprovalRequests((prev) => {
        const next = new Map(prev);
        const updated = { ...request, status: "rejected" as const, rejections: [...request.rejections, newRejection] };
        next.set(`${stepNumber}`, updated);
        return next;
      });

      toast({
        title: "Refusé",
        description: operator
          ? `Refusé par ${operator.operator_name} (${operator.role})`
          : "Action refusée",
      });

      return true;
    } catch (err) {
      console.error("Failed to reject request:", err);
      toast({
        title: "Erreur",
        description: "Impossible de refuser la demande",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [approvalRequests, toast]);

  // Get approval request for a step
  const getApprovalForStep = useCallback((stepNumber: number): ApprovalRequest | null => {
    return approvalRequests.get(`${stepNumber}`) || null;
  }, [approvalRequests]);

  // Check if all required approvals are granted
  const areAllApprovalsGranted = useCallback((stepNumbers: number[]): boolean => {
    return stepNumbers.every((stepNumber) => {
      const request = approvalRequests.get(`${stepNumber}`);
      return request?.status === "approved";
    });
  }, [approvalRequests]);

  // Get all approved step numbers
  const getApprovedSteps = useCallback((): number[] => {
    const approved: number[] = [];
    approvalRequests.forEach((request, key) => {
      if (request.status === "approved") {
        approved.push(parseInt(key, 10));
      }
    });
    return approved;
  }, [approvalRequests]);

  // Reset all approval requests
  const resetApprovals = useCallback(() => {
    setApprovalRequests(new Map());
  }, []);

  return {
    approvalRequests,
    loading,
    createApprovalRequest,
    approveRequest,
    rejectRequest,
    getApprovalForStep,
    areAllApprovalsGranted,
    getApprovedSteps,
    resetApprovals,
  };
}
