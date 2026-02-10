/**
 * API Connector Configuration Panel
 * Configure connections to external APIs with secure credential management
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plug, Plus, Trash2, Key, RefreshCw, CheckCircle, XCircle, Clock, Shield, Settings } from "lucide-react";
import { useApiConnectors, ApiConnector } from "@/hooks/useApiConnectors";
import { formatDistanceToNow } from "date-fns";

const authTypes = [
  { value: "api_key", label: "API Key", description: "Pass API key in header" },
  { value: "bearer", label: "Bearer Token", description: "Authorization: Bearer <token>" },
  { value: "basic", label: "Basic Auth", description: "Username and password" },
  { value: "oauth2", label: "OAuth 2.0", description: "OAuth 2.0 with refresh token" },
  { value: "none", label: "No Auth", description: "Public API" },
];

interface ConnectorsPanelProps {
  projectId: string;
  organizationId: string;
}

export function ConnectorsPanel({ projectId, organizationId }: ConnectorsPanelProps) {
  const { connectors, loading, createConnector, updateConnector, deleteConnector } = useApiConnectors(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<ApiConnector | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    base_url: "",
    auth_type: "api_key",
    auth_header_name: "Authorization",
    auth_prefix: "Bearer",
    auth_credential: "", // The actual API key / token
    timeout_ms: 30000,
    max_retries: 3,
    backoff_ms: 1000,
    rate_limit_requests: "",
    rate_limit_window: 60,
    default_headers: "{}",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      base_url: "",
      auth_type: "api_key",
      auth_header_name: "Authorization",
      auth_prefix: "Bearer",
      auth_credential: "",
      timeout_ms: 30000,
      max_retries: 3,
      backoff_ms: 1000,
      rate_limit_requests: "",
      rate_limit_window: 60,
      default_headers: "{}",
      is_active: true,
    });
    setEditingConnector(null);
    setActiveTab("basic");
  };

  const handleEdit = (connector: ApiConnector) => {
    setEditingConnector(connector);
    const authConfig = connector.auth_config || {};
    setFormData({
      name: connector.name,
      description: connector.description || "",
      base_url: connector.base_url,
      auth_type: connector.auth_type,
      auth_header_name: (authConfig.header_name as string) || "Authorization",
      auth_prefix: (authConfig.prefix as string) || "Bearer",
      auth_credential: "", // Never prefill credentials
      timeout_ms: connector.timeout_ms,
      max_retries: connector.retry_config.max_retries,
      backoff_ms: connector.retry_config.backoff_ms,
      rate_limit_requests: connector.rate_limit_requests?.toString() || "",
      rate_limit_window: connector.rate_limit_window_seconds,
      default_headers: JSON.stringify(connector.default_headers, null, 2),
      is_active: connector.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(formData.default_headers);
    } catch {
      // Invalid JSON, use empty object
    }

    try {
      setSaving(true);
      let credentialSecretId: string | null = editingConnector?.credential_secret_id || null;

      // Create or update secret if credential provided
      if (formData.auth_credential && formData.auth_type !== "none") {
        if (credentialSecretId) {
          // Update existing secret
          await supabase
            .from("secrets")
            .update({ encrypted_value: formData.auth_credential })
            .eq("id", credentialSecretId);
        } else {
          // Create new secret
          const { data: newSecret, error: secretError } = await supabase
            .from("secrets")
            .insert({
              organization_id: organizationId,
              project_id: projectId,
              name: `${formData.name}_credential`,
              description: `API credential for ${formData.name} connector`,
              encrypted_value: formData.auth_credential,
              is_active: true,
            })
            .select("id")
            .single();

          if (secretError) throw secretError;
          credentialSecretId = newSecret.id;
        }
      }

      const connectorData = {
        project_id: projectId,
        api_source_id: null,
        name: formData.name,
        description: formData.description || null,
        base_url: formData.base_url,
        auth_type: formData.auth_type,
        auth_config: {
          header_name: formData.auth_header_name,
          prefix: formData.auth_prefix,
        },
        credential_secret_id: credentialSecretId,
        default_headers: parsedHeaders,
        timeout_ms: formData.timeout_ms,
        retry_config: {
          max_retries: formData.max_retries,
          backoff_ms: formData.backoff_ms,
          backoff_multiplier: 2,
        },
        rate_limit_requests: formData.rate_limit_requests ? parseInt(formData.rate_limit_requests) : null,
        rate_limit_window_seconds: formData.rate_limit_window,
        is_active: formData.is_active,
      };

      if (editingConnector) {
        await updateConnector(editingConnector.id, connectorData);
      } else {
        await createConnector(connectorData);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading connectors...</div>
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
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">API Connectors</CardTitle>
              <CardDescription>Configure secure connections to external APIs</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Connector
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingConnector ? "Edit Connector" : "Add API Connector"}</DialogTitle>
                <DialogDescription>
                  Configure connection settings for an external API
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="auth">Authentication</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Connector Name *</Label>
                    <Input
                      placeholder="e.g., Stripe API"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base URL *</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={formData.base_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Optional description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label>Active</Label>
                  </div>
                </TabsContent>

                <TabsContent value="auth" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Authentication Type</Label>
                    <Select
                      value={formData.auth_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, auth_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {authTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.auth_type !== "none" && (
                    <>
                      <div className="space-y-2">
                        <Label>Header Name</Label>
                        <Input
                          placeholder="Authorization"
                          value={formData.auth_header_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_header_name: e.target.value }))}
                        />
                      </div>

                      {(formData.auth_type === "api_key" || formData.auth_type === "bearer") && (
                        <div className="space-y-2">
                          <Label>Value Prefix</Label>
                          <Input
                            placeholder="Bearer"
                            value={formData.auth_prefix}
                            onChange={(e) => setFormData(prev => ({ ...prev, auth_prefix: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty for no prefix. Header will be: {formData.auth_header_name}: {formData.auth_prefix} {"<credential>"}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>API Key / Token *</Label>
                        <Input
                          type="password"
                          placeholder={editingConnector?.credential_secret_id ? "••••••••  (leave empty to keep current)" : "Enter your API key or token"}
                          value={formData.auth_credential}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_credential: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Stored securely server-side. Never exposed to clients.
                        </p>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Timeout (ms)</Label>
                      <Input
                        type="number"
                        value={formData.timeout_ms}
                        onChange={(e) => setFormData(prev => ({ ...prev, timeout_ms: parseInt(e.target.value) || 30000 }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Retries</Label>
                      <Input
                        type="number"
                        value={formData.max_retries}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rate Limit (requests)</Label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={formData.rate_limit_requests}
                        onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_requests: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rate Limit Window (seconds)</Label>
                      <Input
                        type="number"
                        value={formData.rate_limit_window}
                        onChange={(e) => setFormData(prev => ({ ...prev, rate_limit_window: parseInt(e.target.value) || 60 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Headers (JSON)</Label>
                    <Textarea
                      placeholder='{"X-Custom-Header": "value"}'
                      value={formData.default_headers}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_headers: e.target.value }))}
                      rows={3}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.name || !formData.base_url}>
                  {saving ? "Saving..." : editingConnector ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {connectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Plug className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No API connectors configured yet.
              <br />
              Add a connector to enable secure API calls.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connector</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectors.map((connector) => (
                <TableRow key={connector.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{connector.name}</p>
                      {connector.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {connector.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {connector.base_url.slice(0, 30)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Key className="h-3 w-3" />
                      {connector.auth_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {connector.is_active ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                      {connector.last_error && (
                        <Badge variant="destructive" className="gap-1">
                          Error
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {connector.last_used_at ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(connector.last_used_at), { addSuffix: true })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(connector)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteConnector(connector.id)}
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

        {connectors.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Credentials are encrypted server-side and never exposed to clients
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
