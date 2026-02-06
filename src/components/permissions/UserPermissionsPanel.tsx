/**
 * User Permissions Panel
 * RBAC matrix + ABAC rule builder
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Trash2, Shield, Filter, CheckCircle, XCircle } from "lucide-react";
import { useUserPermissionRules, UserPermissionRule } from "@/hooks/usePermissions";
import type { Database } from "@/integrations/supabase/types";

type PolicyEffect = Database["public"]["Enums"]["policy_effect"];
type AppRole = Database["public"]["Enums"]["app_role"];

const allRoles: AppRole[] = ["owner", "admin", "member", "viewer"];
const resourceTypes = ["action", "project", "endpoint", "api_source", "export"];
const actions = ["execute", "read", "write", "delete", "export", "manage"];

interface UserPermissionsPanelProps {
  organizationId: string;
}

export function UserPermissionsPanel({ organizationId }: UserPermissionsPanelProps) {
  const { rules, loading, createRule, updateRule, deleteRule } = useUserPermissionRules(organizationId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UserPermissionRule | null>(null);
  const [activeTab, setActiveTab] = useState("rules");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    subject_role: "" as AppRole | "",
    resource_type: "action",
    action: "execute",
    effect: "allow" as PolicyEffect,
    conditions: "{}",
    priority: 0,
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      subject_role: "",
      resource_type: "action",
      action: "execute",
      effect: "allow",
      conditions: "{}",
      priority: 0,
      is_active: true,
    });
    setEditingRule(null);
  };

  const handleEdit = (rule: UserPermissionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      subject_role: rule.subject_role || "",
      resource_type: rule.resource_type,
      action: rule.action,
      effect: rule.effect,
      conditions: JSON.stringify(rule.conditions, null, 2),
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    let parsedConditions = {};
    try {
      parsedConditions = JSON.parse(formData.conditions);
    } catch {
      return; // Invalid JSON
    }

    try {
      if (editingRule) {
        await updateRule(editingRule.id, {
          name: formData.name,
          description: formData.description || null,
          subject_role: formData.subject_role || null,
          resource_type: formData.resource_type,
          action: formData.action,
          effect: formData.effect,
          conditions: parsedConditions,
          priority: formData.priority,
          is_active: formData.is_active,
        });
      } else {
        await createRule({
          organization_id: organizationId,
          name: formData.name,
          description: formData.description || null,
          subject_role: formData.subject_role || null,
          subject_user_id: null,
          resource_type: formData.resource_type,
          resource_id: null,
          action: formData.action,
          effect: formData.effect,
          conditions: parsedConditions,
          priority: formData.priority,
          is_active: formData.is_active,
        });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch {
      // Error handled in hook
    }
  };

  // Build RBAC matrix
  const rbacMatrix = allRoles.map(role => {
    const roleRules = rules.filter(r => r.subject_role === role);
    const permissions: Record<string, PolicyEffect | null> = {};
    
    for (const action of actions) {
      const matchingRule = roleRules.find(r => r.action === action);
      permissions[action] = matchingRule?.effect || null;
    }
    
    return { role, permissions, rules: roleRules };
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading permissions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">User Permissions</CardTitle>
              <CardDescription>Configure role-based (RBAC) and attribute-based (ABAC) access rules</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit Permission Rule" : "Add Permission Rule"}</DialogTitle>
                <DialogDescription>
                  Create RBAC or ABAC rules to control user access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Rule Name *</Label>
                  <Input
                    placeholder="e.g., Members can execute read-only actions"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject Role</Label>
                    <Select
                      value={formData.subject_role || "all"}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, subject_role: v === "all" ? "" : v as AppRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {allRoles.map((role) => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Effect</Label>
                    <Select
                      value={formData.effect}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, effect: v as PolicyEffect }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Allow
                          </div>
                        </SelectItem>
                        <SelectItem value="deny">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Deny
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resource Type</Label>
                    <Select
                      value={formData.resource_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, resource_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {resourceTypes.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                      value={formData.action}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, action: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {actions.map((action) => (
                          <SelectItem key={action} value={action} className="capitalize">
                            {action}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    ABAC Conditions (JSON)
                  </Label>
                  <Textarea
                    placeholder='{"region": {"eq": "user.region"}, "amount": {"lte": 10000}}'
                    value={formData.conditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Operators: eq, ne, gt, gte, lt, lte, in, contains
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Higher = evaluated first</p>
                  </div>

                  <div className="space-y-2 flex items-end">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!formData.name}>
                  {editingRule ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="matrix">
              <Shield className="h-4 w-4 mr-2" />
              RBAC Matrix
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Filter className="h-4 w-4 mr-2" />
              All Rules ({rules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matrix">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  {actions.map((action) => (
                    <TableHead key={action} className="text-center capitalize">
                      {action}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rbacMatrix.map(({ role, permissions }) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium capitalize">{role}</TableCell>
                    {actions.map((action) => {
                      const perm = permissions[action];
                      return (
                        <TableCell key={action} className="text-center">
                          {perm === "allow" ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                          ) : perm === "deny" ? (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-4">
              This matrix shows explicitly configured permissions. Owners have full access by default.
            </p>
          </TabsContent>

          <TabsContent value="rules">
            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Filter className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No permission rules configured yet.
                  <br />
                  Default role-based access applies.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Effect</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {rule.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {rule.subject_role || "All"}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{rule.resource_type}</TableCell>
                      <TableCell className="capitalize">{rule.action}</TableCell>
                      <TableCell>
                        <Badge variant={rule.effect === "allow" ? "default" : "destructive"}>
                          {rule.effect}
                        </Badge>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
