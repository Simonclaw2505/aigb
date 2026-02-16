/**
 * Team Panel - Manage organization members
 * List, invite, change roles, remove members
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, MoreHorizontal, Loader2, UserMinus, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const roleBadgeVariant: Record<AppRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

interface OrgMember {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface TeamPanelProps {
  organizationId: string;
}

export function TeamPanel({ organizationId }: TeamPanelProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const { data: membersData, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles for all members
      const userIds = (membersData || []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      setMembers(
        (membersData || []).map((m) => ({
          ...m,
          profile: profileMap.get(m.user_id) || null,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", inviteEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast.error("Aucun utilisateur trouvé avec cet email. L'utilisateur doit d'abord créer un compte.");
        return;
      }

      // Check if already a member
      const existing = members.find((m) => m.user_id === profile.user_id);
      if (existing) {
        toast.error("Cet utilisateur est déjà membre de l'organisation.");
        return;
      }

      const { error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          user_id: profile.user_id,
          role: inviteRole,
        });

      if (error) throw error;

      toast.success("Membre ajouté avec succès !");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout du membre");
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Rôle mis à jour");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    }
  };

  const handleRemove = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast.error("Vous ne pouvez pas vous retirer vous-même.");
      return;
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Membre retiré de l'organisation");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Équipe</CardTitle>
              <CardDescription>
                {members.length} membre{members.length > 1 ? "s" : ""} dans l'organisation
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Inviter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inviter un membre</DialogTitle>
                  <DialogDescription>
                    L'utilisateur doit avoir un compte existant.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="collaborateur@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
                  <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Ajouter
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Ajouté le</TableHead>
                {canManage && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const initials = (member.profile?.full_name || member.profile?.email || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const isCurrentUser = member.user_id === user?.id;

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {member.profile?.full_name || "Sans nom"}
                            {isCurrentUser && (
                              <span className="text-xs text-muted-foreground ml-1">(vous)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.profile?.email || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[member.role]}>
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {!isCurrentUser && member.role !== "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(["admin", "member", "viewer"] as AppRole[])
                                .filter((r) => r !== member.role)
                                .map((r) => (
                                  <DropdownMenuItem key={r} onClick={() => handleChangeRole(member.id, r)}>
                                    Passer en {roleLabels[r]}
                                  </DropdownMenuItem>
                                ))}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleRemove(member.id, member.user_id)}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Retirer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
