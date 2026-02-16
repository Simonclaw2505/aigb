/**
 * Dialog to manage operator keys for a specific agent.
 * Operators are identified by unique keys (no user account needed).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, Copy, KeyRound, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const operatorRoles: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Operator" },
  { value: "viewer", label: "Viewer" },
];

interface OperatorKey {
  id: string;
  name: string;
  role: AppRole;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
}

interface ManageOperatorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  organizationId: string;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOperatorKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "aigb_op_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function ManageOperatorsDialog({
  open, onOpenChange, agentId, agentName, organizationId,
}: ManageOperatorsDialogProps) {
  const { user } = useAuth();
  const [operators, setOperators] = useState<OperatorKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [operatorName, setOperatorName] = useState("");
  const [operatorRole, setOperatorRole] = useState<AppRole>("member");
  const [adding, setAdding] = useState(false);

  // Newly created key (shown once)
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchOperators = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("operator_keys")
        .select("id, name, role, key_prefix, is_active, last_used_at, usage_count, created_at")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOperators(data || []);
    } catch (err) {
      console.error("Failed to fetch operators:", err);
    } finally {
      setLoading(false);
    }
  }, [open, agentId]);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // Reset new key display when dialog closes
  useEffect(() => {
    if (!open) {
      setNewKey(null);
      setNewKeyName("");
      setCopied(false);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!operatorName.trim()) return;
    setAdding(true);
    try {
      const rawKey = generateOperatorKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 14) + "...";

      const { error } = await supabase.from("operator_keys").insert({
        agent_id: agentId,
        organization_id: organizationId,
        name: operatorName.trim(),
        role: operatorRole,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: user?.id,
      });

      if (error) throw error;

      setNewKey(rawKey);
      setNewKeyName(operatorName.trim());
      setOperatorName("");
      setOperatorRole("member");
      fetchOperators();
      toast.success("Opérateur créé");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setAdding(false);
    }
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      toast.success("Clé copiée dans le presse-papier");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleChangeRole = async (id: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from("operator_keys")
        .update({ role: newRole })
        .eq("id", id);
      if (error) throw error;
      toast.success("Rôle mis à jour");
      fetchOperators();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("operator_keys")
        .update({ is_active: !currentActive })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentActive ? "Clé révoquée" : "Clé réactivée");
      fetchOperators();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("operator_keys")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Opérateur supprimé");
      fetchOperators();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Opérateurs : {agentName}
          </DialogTitle>
          <DialogDescription>
            Créez des opérateurs avec une clé de vérification unique. Aucun compte utilisateur n'est requis.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* New key display */}
            {newKey && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Clé de {newKeyName} — copiez-la maintenant, elle ne sera plus affichée
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded border font-mono break-all">
                    {newKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Add operator form */}
            <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Nom</Label>
                <Input
                  placeholder="Jean Dupont"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Rôle</Label>
                <Select value={operatorRole} onValueChange={(v) => setOperatorRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={!operatorName.trim() || adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Operators list */}
            {operators.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun opérateur pour cet agent.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opérateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Clé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operators.map((op) => {
                    const roleLabel = operatorRoles.find((r) => r.value === op.role)?.label || op.role;
                    return (
                      <TableRow key={op.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{op.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {op.usage_count} utilisation{op.usage_count !== 1 ? "s" : ""}
                              {op.last_used_at && ` · ${new Date(op.last_used_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={op.role}
                            onValueChange={(v) => handleChangeRole(op.id, v as AppRole)}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operatorRoles.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono text-muted-foreground">{op.key_prefix}</code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={op.is_active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(op.id, op.is_active)}
                          >
                            {op.is_active ? "Actif" : "Révoqué"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(op.id)}
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
