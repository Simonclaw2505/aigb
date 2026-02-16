/**
 * Action Builder Form Component
 * Comprehensive form for creating/editing agent-friendly actions
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wand2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plus,
  Trash2,
  Info,
  Sparkles,
  Save,
  RotateCcw,
  Bot,
  Clock,
  Globe,
} from "lucide-react";
import type { RiskLevel, ActionExample, ActionConstraints } from "@/lib/action-suggestions";

export interface ActionFormData {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  isIdempotent: boolean;
  inputSchema: object;
  outputSchema: object | null;
  endpointMethod: string;
  endpointPath: string;
  examples: ActionExample[];
  constraints: ActionConstraints;
  version: number;
  isEnabled: boolean;
  requiresApproval: boolean;
  agentPolicy: 'allow' | 'deny' | 'require_confirmation' | 'require_approval';
  approvalRoles: string[];
  maxExecutionsPerHour?: number;
  maxExecutionsPerDay?: number;
  allowedEnvironments: string[];
}

interface ActionBuilderFormProps {
  initialData: ActionFormData;
  suggestion?: ActionFormData;
  onSave: (data: ActionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Risk level configuration
const RISK_LEVELS: Record<RiskLevel, { label: string; icon: React.ElementType; color: string; description: string }> = {
  read_only: {
    label: "Read Only",
    icon: ShieldCheck,
    color: "text-emerald-500",
    description: "No data modification, safe to execute freely",
  },
  safe_write: {
    label: "Safe Write",
    icon: Shield,
    color: "text-blue-500",
    description: "Creates or modifies data with low risk, typically reversible",
  },
  risky_write: {
    label: "Risky Write",
    icon: ShieldAlert,
    color: "text-amber-500",
    description: "Significant changes that require careful consideration",
  },
  irreversible: {
    label: "Irreversible",
    icon: ShieldX,
    color: "text-red-500",
    description: "Cannot be undone - requires confirmation before execution",
  },
};

export function ActionBuilderForm({
  initialData,
  suggestion,
  onSave,
  onCancel,
  isLoading = false,
}: ActionBuilderFormProps) {
  const [formData, setFormData] = useState<ActionFormData>(initialData);
  const [activeTab, setActiveTab] = useState("basic");

  // Intermediate text states for JSON fields
  const [inputSchemaText, setInputSchemaText] = useState(() =>
    JSON.stringify(initialData.inputSchema, null, 2)
  );
  const [inputSchemaError, setInputSchemaError] = useState<string | null>(null);

  const [outputSchemaText, setOutputSchemaText] = useState(() =>
    initialData.outputSchema ? JSON.stringify(initialData.outputSchema, null, 2) : ""
  );
  const [outputSchemaError, setOutputSchemaError] = useState<string | null>(null);

  const [exampleParamsTexts, setExampleParamsTexts] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    initialData.examples.forEach((ex, i) => {
      map[i] = JSON.stringify(ex.expectedParams, null, 2);
    });
    return map;
  });
  const [exampleParamsErrors, setExampleParamsErrors] = useState<Record<number, string | null>>({});

  // Sync text states when formData changes externally (e.g. apply suggestion, reset)
  const [lastSyncKey, setLastSyncKey] = useState(0);
  const syncTextsFromFormData = useCallback((data: ActionFormData) => {
    setInputSchemaText(JSON.stringify(data.inputSchema, null, 2));
    setInputSchemaError(null);
    setOutputSchemaText(data.outputSchema ? JSON.stringify(data.outputSchema, null, 2) : "");
    setOutputSchemaError(null);
    const map: Record<number, string> = {};
    data.examples.forEach((ex, i) => {
      map[i] = JSON.stringify(ex.expectedParams, null, 2);
    });
    setExampleParamsTexts(map);
    setExampleParamsErrors({});
  }, []);

  // Update a single field
  const updateField = <K extends keyof ActionFormData>(
    field: K,
    value: ActionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Apply suggestion to a field
  const applySuggestion = (field: keyof ActionFormData) => {
    if (suggestion && suggestion[field] !== undefined) {
      updateField(field, suggestion[field]);
    }
  };

  // Apply all suggestions
  const applyAllSuggestions = () => {
    if (suggestion) {
      setFormData(suggestion);
      syncTextsFromFormData(suggestion);
    }
  };

  // Reset to initial data
  const resetForm = () => {
    setFormData(initialData);
    syncTextsFromFormData(initialData);
  };

  // Apply suggestion to a single field - also sync text if it's a JSON field
  const applySuggestionAndSync = (field: keyof ActionFormData) => {
    if (suggestion && suggestion[field] !== undefined) {
      updateField(field, suggestion[field]);
      if (field === "inputSchema") {
        setInputSchemaText(JSON.stringify(suggestion.inputSchema, null, 2));
        setInputSchemaError(null);
      } else if (field === "outputSchema") {
        setOutputSchemaText(suggestion.outputSchema ? JSON.stringify(suggestion.outputSchema, null, 2) : "");
        setOutputSchemaError(null);
      } else if (field === "examples") {
        const map: Record<number, string> = {};
        suggestion.examples.forEach((ex, i) => {
          map[i] = JSON.stringify(ex.expectedParams, null, 2);
        });
        setExampleParamsTexts(map);
        setExampleParamsErrors({});
      }
    }
  };

  // Add example
  const addExample = () => {
    setFormData((prev) => {
      const newExamples = [...prev.examples, { prompt: "", expectedParams: {} }];
      return { ...prev, examples: newExamples };
    });
    setExampleParamsTexts((prev) => ({ ...prev, [formData.examples.length]: "{}" }));
  };

  // Update example
  const updateExample = (index: number, field: keyof ActionExample, value: any) => {
    setFormData((prev) => {
      const newExamples = [...prev.examples];
      newExamples[index] = { ...newExamples[index], [field]: value };
      return { ...prev, examples: newExamples };
    });
  };

  // Remove example
  const removeExample = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  // Check if field differs from suggestion
  const hasSuggestion = (field: keyof ActionFormData): boolean => {
    if (!suggestion) return false;
    return JSON.stringify(formData[field]) !== JSON.stringify(suggestion[field]);
  };

  const RiskIcon = RISK_LEVELS[formData.riskLevel].icon;

  return (
    <div className="space-y-6">
      {/* Header with suggestions */}
      {suggestion && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                AI suggestions available based on endpoint analysis
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={applyAllSuggestions}>
              <Wand2 className="h-4 w-4 mr-2" />
              Apply All
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6 mt-6">
          {/* Action Name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Action Name</Label>
              {hasSuggestion("name") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applySuggestion("name")}
                  className="h-6 text-xs text-primary"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Use: {suggestion?.name}
                </Button>
              )}
            </div>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., get_user, create_order"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use snake_case with a verb prefix (get_, create_, update_, delete_)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              {hasSuggestion("description") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applySuggestion("description")}
                  className="h-6 text-xs text-primary"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Use suggestion
                </Button>
              )}
            </div>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Clear description of what this action does..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This description is shown to AI agents to help them understand the action
            </p>
          </div>

          {/* Risk Level */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Risk Level</Label>
              {hasSuggestion("riskLevel") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applySuggestion("riskLevel")}
                  className="h-6 text-xs text-primary"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Use: {RISK_LEVELS[suggestion?.riskLevel || "read_only"].label}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(RISK_LEVELS) as RiskLevel[]).map((level) => {
                const config = RISK_LEVELS[level];
                const Icon = config.icon;
                const isSelected = formData.riskLevel === level;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateField("riskLevel", level)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                    <div>
                      <p className="font-medium text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Endpoint Binding */}
          <div className="space-y-2">
            <Label>Endpoint Binding</Label>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="font-mono text-sm px-3 py-1.5"
              >
                {formData.endpointMethod}
              </Badge>
              <Input
                value={formData.endpointPath}
                disabled
                className="font-mono text-sm bg-muted"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Action is available for agent use
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.isEnabled}
                onCheckedChange={(v) => updateField("isEnabled", v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="idempotent">Idempotent</Label>
                <p className="text-xs text-muted-foreground">
                  Safe to retry without side effects
                </p>
              </div>
              <Switch
                id="idempotent"
                checked={formData.isIdempotent}
                onCheckedChange={(v) => updateField("isIdempotent", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="approval">Requires Approval</Label>
                <p className="text-xs text-muted-foreground">
                  Human must approve before execution
                </p>
              </div>
              <Switch
                id="approval"
                checked={formData.requiresApproval}
                onCheckedChange={(v) => updateField("requiresApproval", v)}
              />
            </div>
          </div>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label>Input Schema (JSON Schema)</Label>
            <Textarea
              value={inputSchemaText}
              onChange={(e) => setInputSchemaText(e.target.value)}
              onBlur={() => {
                try {
                  updateField("inputSchema", JSON.parse(inputSchemaText));
                  setInputSchemaError(null);
                } catch {
                  setInputSchemaError("JSON invalide");
                }
              }}
              rows={12}
              className={`font-mono text-sm ${inputSchemaError ? "border-destructive" : ""}`}
              placeholder='{"type": "object", "properties": {...}}'
            />
            {inputSchemaError && (
              <p className="text-xs text-destructive">{inputSchemaError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              JSON Schema defining the input parameters for this action
            </p>
          </div>

          <div className="space-y-2">
            <Label>Output Schema (JSON Schema)</Label>
            <Textarea
              value={outputSchemaText}
              onChange={(e) => setOutputSchemaText(e.target.value)}
              onBlur={() => {
                try {
                  updateField("outputSchema", outputSchemaText.trim() ? JSON.parse(outputSchemaText) : null);
                  setOutputSchemaError(null);
                } catch {
                  setOutputSchemaError("JSON invalide");
                }
              }}
              rows={8}
              className={`font-mono text-sm ${outputSchemaError ? "border-destructive" : ""}`}
              placeholder='{"type": "object", "properties": {...}}'
            />
            {outputSchemaError && (
              <p className="text-xs text-destructive">{outputSchemaError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Optional schema describing the expected response structure
            </p>
          </div>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Example Prompts</h3>
              <p className="text-sm text-muted-foreground">
                Help agents understand when to use this action
              </p>
            </div>
            {hasSuggestion("examples") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => applySuggestionAndSync("examples")}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Use Suggestions
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {formData.examples.map((example, index) => (
              <Card key={index}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs">Prompt</Label>
                      <Input
                        value={example.prompt}
                        onChange={(e) => updateExample(index, "prompt", e.target.value)}
                        placeholder="Example user prompt..."
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeExample(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Expected Parameters (JSON)</Label>
                    <Textarea
                      value={exampleParamsTexts[index] ?? JSON.stringify(example.expectedParams, null, 2)}
                      onChange={(e) => setExampleParamsTexts((prev) => ({ ...prev, [index]: e.target.value }))}
                      onBlur={() => {
                        const text = exampleParamsTexts[index];
                        if (text === undefined) return;
                        try {
                          updateExample(index, "expectedParams", JSON.parse(text));
                          setExampleParamsErrors((prev) => ({ ...prev, [index]: null }));
                        } catch {
                          setExampleParamsErrors((prev) => ({ ...prev, [index]: "JSON invalide" }));
                        }
                      }}
                      rows={4}
                      className={`font-mono text-sm ${exampleParamsErrors[index] ? "border-destructive" : ""}`}
                      placeholder='{"id": "123"}'
                    />
                    {exampleParamsErrors[index] && (
                      <p className="text-xs text-destructive">{exampleParamsErrors[index]}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" onClick={addExample} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Example
          </Button>
        </TabsContent>

        {/* Constraints Tab */}
        <TabsContent value="constraints" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Execution Constraints</h3>
              <p className="text-sm text-muted-foreground">
                Limits and safety rails for this action
              </p>
            </div>
            {hasSuggestion("constraints") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => applySuggestion("constraints")}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Use Suggestions
              </Button>
            )}
          </div>

          {/* Agent Policy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Agent Policy
              </CardTitle>
              <CardDescription>How the agent interacts with this action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Policy</Label>
                <Select
                  value={formData.agentPolicy}
                  onValueChange={(v) => updateField("agentPolicy", v as ActionFormData["agentPolicy"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                    <SelectItem value="require_confirmation">Require Confirmation</SelectItem>
                    <SelectItem value="require_approval">Require Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.agentPolicy === "require_approval" && (
                <div className="space-y-2">
                  <Label className="text-xs">Approval Roles</Label>
                  <div className="flex flex-wrap gap-3">
                    {["owner", "admin", "member", "viewer"].map((role) => (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={formData.approvalRoles.includes(role)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...formData.approvalRoles, role]
                              : formData.approvalRoles.filter((r) => r !== role);
                            updateField("approvalRoles", next);
                          }}
                        />
                        <span className="capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Quotas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Execution Quotas
              </CardTitle>
              <CardDescription>Limit how often this action can run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Max / Hour</Label>
                  <Input
                    type="number"
                    value={formData.maxExecutionsPerHour ?? ""}
                    onChange={(e) =>
                      updateField("maxExecutionsPerHour", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="No limit"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Max / Day</Label>
                  <Input
                    type="number"
                    value={formData.maxExecutionsPerDay ?? ""}
                    onChange={(e) =>
                      updateField("maxExecutionsPerDay", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="No limit"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Allowed Environments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Allowed Environments
              </CardTitle>
              <CardDescription>Where this action can be executed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {["development", "staging", "production"].map((env) => (
                  <label key={env} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={formData.allowedEnvironments.includes(env)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...formData.allowedEnvironments, env]
                          : formData.allowedEnvironments.filter((e) => e !== env);
                        updateField("allowedEnvironments", next);
                      }}
                    />
                    <span className="capitalize">{env}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Rate Limit */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Rate Limit</CardTitle>
                <CardDescription>Maximum requests per time window</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Requests</Label>
                    <Input
                      type="number"
                      value={formData.constraints.rateLimit?.requests || ""}
                      onChange={(e) =>
                        updateField("constraints", {
                          ...formData.constraints,
                          rateLimit: {
                            requests: parseInt(e.target.value) || 0,
                            windowSeconds: formData.constraints.rateLimit?.windowSeconds || 60,
                          },
                        })
                      }
                      placeholder="60"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Window (sec)</Label>
                    <Input
                      type="number"
                      value={formData.constraints.rateLimit?.windowSeconds || ""}
                      onChange={(e) =>
                        updateField("constraints", {
                          ...formData.constraints,
                          rateLimit: {
                            requests: formData.constraints.rateLimit?.requests || 60,
                            windowSeconds: parseInt(e.target.value) || 60,
                          },
                        })
                      }
                      placeholder="60"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeout */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Timeout</CardTitle>
                <CardDescription>Maximum execution time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={formData.constraints.timeout || ""}
                    onChange={(e) =>
                      updateField("constraints", {
                        ...formData.constraints,
                        timeout: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="30000"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Max Rows */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Max Rows</CardTitle>
                <CardDescription>Limit for list operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Label className="text-xs">Maximum rows returned</Label>
                  <Input
                    type="number"
                    value={formData.constraints.maxRows || ""}
                    onChange={(e) =>
                      updateField("constraints", {
                        ...formData.constraints,
                        maxRows: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="100"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Confirmation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Confirmation</CardTitle>
                <CardDescription>Require explicit confirmation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requires-confirm" className="text-xs">
                    Agent must confirm before executing
                  </Label>
                  <Switch
                    id="requires-confirm"
                    checked={formData.constraints.requiresConfirmation || false}
                    onCheckedChange={(v) =>
                      updateField("constraints", {
                        ...formData.constraints,
                        requiresConfirmation: v,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Version {formData.version}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={resetForm}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              // Validate all JSON fields before saving
              let hasError = false;
              try {
                JSON.parse(inputSchemaText);
              } catch {
                setInputSchemaError("JSON invalide");
                setActiveTab("schema");
                hasError = true;
              }
              if (outputSchemaText.trim()) {
                try {
                  JSON.parse(outputSchemaText);
                } catch {
                  setOutputSchemaError("JSON invalide");
                  if (!hasError) setActiveTab("schema");
                  hasError = true;
                }
              }
              for (const [idx, text] of Object.entries(exampleParamsTexts)) {
                try {
                  JSON.parse(text);
                } catch {
                  setExampleParamsErrors((prev) => ({ ...prev, [Number(idx)]: "JSON invalide" }));
                  if (!hasError) setActiveTab("examples");
                  hasError = true;
                }
              }
              if (hasError) {
                toast({ title: "JSON invalide", description: "Corrigez les champs JSON en erreur avant de sauvegarder.", variant: "destructive" });
                return;
              }
              onSave(formData);
            }}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Action"}
          </Button>
        </div>
      </div>
    </div>
  );
}
