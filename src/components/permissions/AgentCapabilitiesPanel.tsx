/**
 * Agent Capabilities Panel
 * Configure what the AI agent can do per action in a project
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Bot, Shield, AlertTriangle, Ban, CheckCircle, Clock, Plus, Trash2, Lock, FlaskConical } from "lucide-react";
import { useAgentCapabilities, AgentCapability } from "@/hooks/usePermissions";
import type { Database } from "@/integrations/supabase/types";

type AgentCapabilityPolicy = Database["public"]["Enums"]["agent_capability_policy"];
type AppRole = Database["public"]["Enums"]["app_role"];
type EnvironmentType = Database["public"]["Enums"]["environment_type"];

const policyConfig: Record<AgentCapabilityPolicy, { label: string; icon: React.ReactNode; color: string }> = {
  allow: { label: "Allow", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500" },
  deny: { label: "Deny", icon: <Ban className="h-4 w-4" />, color: "text-red-500" },
  require_confirmation: { label: "Require Confirmation", icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-500" },
  require_approval: { label: "Require Approval", icon: <Clock className="h-4 w-4" />, color: "text-blue-500" },
};

const allRoles: AppRole[] = ["owner", "admin", "member", "viewer"];
const allEnvironments: EnvironmentType[] = ["development", "staging", "production"];

interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  risk_level: string;
}

interface AgentCapabilitiesPanelProps {
  projectId: string;
  actionTemplates: ActionTemplate[];
}

export function AgentCapabilitiesPanel({ projectId, actionTemplates }: AgentCapabilitiesPanelProps) {
  const { capabilities, loading, createCapability, updateCapability, deleteCapability } = useAgentCapabilities(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCapability, setEditingCapability] = useState<AgentCapability | null>(null);

  const [formData, setFormData] = useState({
    action_template_id: "",
    policy: "allow" as AgentCapabilityPolicy,
    approval_roles: ["owner", "admin"] as AppRole[],
    max_executions_per_hour: "",
    max_executions_per_day: "",
    allowed_environments: ["development", "staging", "production"] as EnvironmentType[],
    is_active: true,
    // New security fields
    free_executions: "",
    max_batch_size: "",
    required_approvals: 1,
    requires_security_pin: false,
    require_sandbox_first: false,
  });

  const resetForm = () => {
    setFormData({
      action_template_id: "",
      policy: "allow",
      approval_roles: ["owner", "admin"],
      max_executions_per_hour: "",
      max_executions_per_day: "",
      allowed_environments: ["development", "staging", "production"],
      is_active: true,
      free_executions: "",
      max_batch_size: "",
      required_approvals: 1,
      requires_security_pin: false,
      require_sandbox_first: false,
    });
    setEditingCapability(null);
  };

  const handleEdit = (cap: AgentCapability) => {
    setEditingCapability(cap);
    // Access extended fields with type assertion
    const extendedCap = cap as AgentCapability & {
      free_executions?: number | null;
      max_batch_size?: number | null;
      required_approvals?: number;
      requires_security_pin?: boolean;
      require_sandbox_first?: boolean;
    };
    setFormData({
      action_template_id: cap.action_template_id || "",
      policy: cap.policy,
      approval_roles: cap.approval_roles || ["owner", "admin"],
      max_executions_per_hour: cap.max_executions_per_hour?.toString() || "",
      max_executions_per_day: cap.max_executions_per_day?.toString() || "",
      allowed_environments: cap.allowed_environments || ["development", "staging", "production"],
      is_active: cap.is_active,
      free_executions: extendedCap.free_executions?.toString() || "",
      max_batch_size: extendedCap.max_batch_size?.toString() || "",
      required_approvals: extendedCap.required_approvals || 1,
      requires_security_pin: extendedCap.requires_security_pin || false,
      require_sandbox_first: extendedCap.require_sandbox_first || false,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const updateData = {
        policy: formData.policy,
        approval_roles: formData.approval_roles,
        max_executions_per_hour: formData.max_executions_per_hour ? parseInt(formData.max_executions_per_hour) : null,
        max_executions_per_day: formData.max_executions_per_day ? parseInt(formData.max_executions_per_day) : null,
        allowed_environments: formData.allowed_environments,
        is_active: formData.is_active,
        // New security fields - using type assertion for new columns
        ...(formData.free_executions ? { free_executions: parseInt(formData.free_executions) } : {}),
        ...(formData.max_batch_size ? { max_batch_size: parseInt(formData.max_batch_size) } : {}),
        required_approvals: formData.required_approvals,
        requires_security_pin: formData.requires_security_pin,
        require_sandbox_first: formData.require_sandbox_first,
      };

      if (editingCapability) {
        await updateCapability(editingCapability.id, updateData as Partial<AgentCapability>);
      } else {
        await createCapability({
          project_id: projectId,
          action_template_id: formData.action_template_id || null,
          action_name: null,
          ...updateData,
        } as Omit<AgentCapability, "id" | "created_at" | "updated_at" | "action_template">);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch {
      // Error handled in hook
    }
  };

  const configuredActionIds = new Set(capabilities.map(c => c.action_template_id));
  const unconfiguredActions = actionTemplates.filter(a => !configuredActionIds.has(a.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading capabilities...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Agent Capabilities</CardTitle>
              <CardDescription>Control what the AI agent can do with each action</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={unconfiguredActions.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Capability
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCapability ? "Edit Capability" : "Add Agent Capability"}</DialogTitle>
                <DialogDescription>
                  Configure what the agent can do with this action
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!editingCapability && (
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                      value={formData.action_template_id || undefined}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, action_template_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an action" />
                      </SelectTrigger>
                      <SelectContent>
                        {unconfiguredActions
                          .filter((action) => action.id && action.id.trim() !== "")
                          .map((action) => (
                            <SelectItem key={action.id} value={action.id}>
                              {action.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Policy</Label>
                  <Select
                    value={formData.policy}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, policy: v as AgentCapabilityPolicy }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(policyConfig).map(([key, { label, icon }]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {icon}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(formData.policy === "require_approval") && (
                  <div className="space-y-2">
                    <Label>Approval Roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={formData.approval_roles.includes(role)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                approval_roles: checked
                                  ? [...prev.approval_roles, role]
                                  : prev.approval_roles.filter(r => r !== role),
                              }));
                            }}
                          />
                          <span className="capitalize">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Executions/Hour</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={formData.max_executions_per_hour}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_executions_per_hour: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Executions/Day</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={formData.max_executions_per_day}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_executions_per_day: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Allowed Environments</Label>
                  <div className="flex flex-wrap gap-2">
                    {allEnvironments.map((env) => (
                      <label key={env} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={formData.allowed_environments.includes(env)}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              allowed_environments: checked
                                ? [...prev.allowed_environments, env]
                                : prev.allowed_environments.filter(e => e !== env),
                            }));
                          }}
                        />
                        <span className="capitalize">{env}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!editingCapability && !formData.action_template_id}>
                  {editingCapability ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No agent capabilities configured yet.
              <br />
              All actions are allowed by default.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Environments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capabilities.map((cap) => {
                const policy = policyConfig[cap.policy];
                return (
                  <TableRow key={cap.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cap.action_template?.name || cap.action_name || "Global"}</p>
                        {cap.action_template?.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {cap.action_template.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${policy.color}`}>
                        {policy.icon}
                        {policy.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cap.max_executions_per_hour || cap.max_executions_per_day ? (
                        <div className="text-sm">
                          {cap.max_executions_per_hour && <div>{cap.max_executions_per_hour}/hr</div>}
                          {cap.max_executions_per_day && <div>{cap.max_executions_per_day}/day</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No limit</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(cap.allowed_environments || []).map((env) => (
                          <Badge key={env} variant="secondary" className="text-xs capitalize">
                            {env.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cap.is_active ? "default" : "secondary"}>
                        {cap.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(cap)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteCapability(cap.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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
