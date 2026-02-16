/**
 * Dialog to manage members assigned to a specific agent
 * Assign org members with a per-agent role (admin/operator/viewer)
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Trash2, UserPlus, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const agentRoles: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Operator" },
  { value: "viewer", label: "Viewer" },
];

interface AgentMember {
  id: string;
  user_id: string;
  role: AppRole;
  profile: { full_name: string | null; email: string | null } | null;
}

interface OrgMemberOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface ManageAgentMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  organizationId: string;
}

export function ManageAgentMembersDialog({
  open, onOpenChange, agentId, agentName, organizationId,
}: ManageAgentMembersDialogProps) {
  const { user } = useAuth();
  const [agentMembers, setAgentMembers] = useState<AgentMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("member");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      // Fetch agent members
      const { data: amData } = await supabase
        .from("agent_members")
        .select("id, user_id, role")
        .eq("agent_id", agentId);

      const amUserIds = (amData || []).map((m) => m.user_id);

      // Fetch profiles for agent members
      let amProfiles: Record<string, { full_name: string | null; email: string | null }> = {};
      if (amUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", amUserIds);
        (profiles || []).forEach((p) => {
          amProfiles[p.user_id] = p;
        });
      }

      setAgentMembers(
        (amData || []).map((m) => ({
          ...m,
          profile: amProfiles[m.user_id] || null,
        }))
      );

      // Fetch all org members not yet assigned
      const { data: orgMembersData } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);

      const allOrgUserIds = (orgMembersData || []).map((m) => m.user_id);
      const unassigned = allOrgUserIds.filter((uid) => !amUserIds.includes(uid));

      if (unassigned.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", unassigned);
        setOrgMembers(profiles || []);
      } else {
        setOrgMembers([]);
      }
    } catch (err) {
      console.error("Failed to fetch agent members:", err);
    } finally {
      setLoading(false);
    }
  }, [open, agentId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("agent_members").insert({
        agent_id: agentId,
        user_id: selectedUserId,
        role: selectedRole,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Membre ajouté à l'agent");
      setSelectedUserId("");
      setSelectedRole("member");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setAdding(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from("agent_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Rôle mis à jour");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("agent_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Membre retiré de l'agent");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Membres de l'agent : {agentName}</DialogTitle>
          <DialogDescription>
            Assignez des membres de l'organisation à cet agent avec un rôle spécifique.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add member */}
            {orgMembers.length > 0 && (
              <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Membre</label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un membre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orgMembers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Rôle</label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agentRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={handleAdd} disabled={!selectedUserId || adding}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Members list */}
            {agentMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun membre assigné à cet agent.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentMembers.map((m) => {
                    const initials = (m.profile?.full_name || m.profile?.email || "?")
                      .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                    const roleLabel = agentRoles.find((r) => r.value === m.role)?.label || m.role;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{m.profile?.full_name || "Sans nom"}</p>
                              <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={m.role}
                            onValueChange={(v) => handleChangeRole(m.id, v as AppRole)}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {agentRoles.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemove(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
