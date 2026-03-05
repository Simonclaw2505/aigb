/**
 * Export page for MCP Foundry
 * Generate and download versioned MCP configuration files
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProjectBanner } from "@/components/layout/ProjectBanner";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileJson,
  FileCode,
  Copy,
  Check,
  Package,
  Link,
  Clock,
  Loader2,
  History,
  ExternalLink,
} from "lucide-react";
import { useExport, MCPExport } from "@/hooks/useExport";
import { formatDistanceToNow } from "date-fns";
import { OpenAIExportCard } from "@/components/export/OpenAIExportCard";
import { IntegrationGuide } from "@/components/export/IntegrationGuide";

export default function Export() {
  const [format, setFormat] = useState<"json" | "yaml">("json");
  const [includeAuth, setIncludeAuth] = useState(true);
  const [includeSchemas, setIncludeSchemas] = useState(true);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [endpointCopied, setEndpointCopied] = useState(false);
  const [previewExport, setPreviewExport] = useState<MCPExport | null>(null);

  const { currentProject, isLoading: projectLoading } = useCurrentProject();
  const selectedProject = currentProject?.id || null;

  const {
    exports,
    loading,
    generating,
    fetchExports,
    generateExport,
    downloadExport,
    copyToClipboard,
    getApiEndpoint,
    getMcpServerEndpoint,
  } = useExport({ projectId: selectedProject });

  const [mcpCopied, setMcpCopied] = useState(false);

  // Fetch exports when project changes
  useEffect(() => {
    if (selectedProject) {
      fetchExports();
    }
  }, [selectedProject, fetchExports]);

  // Set preview to latest export
  useEffect(() => {
    if (exports.length > 0) {
      setPreviewExport(exports.find((e) => e.isLatest) || exports[0]);
    } else {
      setPreviewExport(null);
    }
  }, [exports]);

  const hasActions = previewExport && previewExport.manifest.tools.length > 0;

  const handleGenerate = async () => {
    const result = await generateExport({
      releaseNotes: releaseNotes.trim() || undefined,
      includeAuth,
      includeSchemas,
    });
    if (result) {
      setPreviewExport(result);
      setReleaseNotes("");
    }
  };

  const handleDownload = () => {
    if (previewExport) {
      downloadExport(previewExport, format);
    }
  };

  const handleCopy = async () => {
    if (previewExport) {
      await copyToClipboard(previewExport, format);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyEndpoint = async () => {
    const endpoint = getApiEndpoint();
    await navigator.clipboard.writeText(endpoint);
    setEndpointCopied(true);
    setTimeout(() => setEndpointCopied(false), 2000);
  };

  const handleCopyMcpEndpoint = async () => {
    const endpoint = getMcpServerEndpoint();
    await navigator.clipboard.writeText(endpoint);
    setMcpCopied(true);
    setTimeout(() => setMcpCopied(false), 2000);
  };

  if (projectLoading) {
    return (
      <DashboardLayout title="Export" description="Generate MCP configuration for your AI agents">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Export"
      description="Generate versioned MCP packages for your AI agents"
    >
      <ProjectBanner>
      <div className="space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Configuration</CardTitle>
              <CardDescription>
                Choose format and options for your MCP export
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format selection */}
              <div className="space-y-3">
                <Label>Output Format</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as "json" | "yaml")}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="json" id="json" className="peer sr-only" />
                    <Label
                      htmlFor="json"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileJson className="mb-3 h-6 w-6" />
                      <span className="font-medium">JSON</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Standard MCP format
                      </span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="yaml" id="yaml" className="peer sr-only" />
                    <Label
                      htmlFor="yaml"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileCode className="mb-3 h-6 w-6" />
                      <span className="font-medium">YAML</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Human-readable
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-4">
                <Label>Export Options</Label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Include Authentication</p>
                    <p className="text-xs text-muted-foreground">
                      Add auth configuration to the export
                    </p>
                  </div>
                  <Switch checked={includeAuth} onCheckedChange={setIncludeAuth} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Include Schemas</p>
                    <p className="text-xs text-muted-foreground">
                      Embed JSON schemas for parameters
                    </p>
                  </div>
                  <Switch
                    checked={includeSchemas}
                    onCheckedChange={setIncludeSchemas}
                  />
                </div>
              </div>

              <Separator />

              {/* Release notes */}
              <div className="space-y-2">
                <Label htmlFor="release-notes">Release Notes (optional)</Label>
                <Textarea
                  id="release-notes"
                  placeholder="Describe changes in this version..."
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator />

              {/* Generate button */}
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generating || !selectedProject}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Generate New Version
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <div className="space-y-6">
            {/* MCP Server for AI Agents */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  MCP Server (for AI agents)
                </CardTitle>
                <CardDescription>
                  Use this URL with GPT, Claude, Cursor or any MCP client
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getMcpServerEndpoint()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyMcpEndpoint}
                  >
                    {mcpCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Authenticate with your API key (Settings → API Keys) via the{" "}
                  <code className="bg-muted px-1 rounded">Authorization: Bearer</code> header
                  or <code className="bg-muted px-1 rounded">X-API-Key</code> header.
                </p>
              </CardContent>
            </Card>

            {/* REST API Endpoint */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  API Endpoint (REST)
                </CardTitle>
                <CardDescription>
                  Fetch the latest export programmatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={selectedProject ? getApiEndpoint() : "Select a project first"}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyEndpoint}
                    disabled={!selectedProject}
                  >
                    {endpointCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add <code className="bg-muted px-1 rounded">?format=yaml</code> for YAML
                  or <code className="bg-muted px-1 rounded">?version=X.0.0</code> for specific version
                </p>
              </CardContent>
            </Card>

            {/* Download/Copy actions */}
            {previewExport && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Version {previewExport.version}
                    </CardTitle>
                    {previewExport.isLatest && (
                      <Badge variant="default">Latest</Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(previewExport.createdAt), {
                      addSuffix: true,
                    })}
                    {previewExport.fileSizeBytes && (
                      <span>• {(previewExport.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      Download .{format}
                    </Button>
                    <Button variant="outline" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  {previewExport.releaseNotes && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      <strong>Notes:</strong> {previewExport.releaseNotes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Preview or empty state */}
        {!previewExport ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No exports yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Generate your first MCP package by clicking the button above
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Preview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>
                  {previewExport.manifest.tools.length} tools •{" "}
                  {previewExport.manifest.permissions.agentCapabilities.length} capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-auto max-h-[400px]">
                  {format === "json"
                    ? JSON.stringify(previewExport.manifest, null, 2)
                    : `# MCP Export v${previewExport.version}\n` +
                      `version: "${previewExport.version}"\n` +
                      `name: "${previewExport.manifest.name}"\n` +
                      `serverUrl: "${previewExport.manifest.serverUrl}"\n` +
                      `authMethod: "${previewExport.manifest.authMethod}"\n` +
                      `tools: [${previewExport.manifest.tools.length} items]\n` +
                      `createdAt: "${previewExport.manifest.createdAt}"`}
                </pre>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : exports.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No versions yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {exports.map((exp) => (
                      <button
                        key={exp.id}
                        onClick={() => setPreviewExport(exp)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          previewExport?.id === exp.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">v{exp.version}</span>
                          {exp.isLatest && (
                            <Badge variant="secondary" className="text-xs">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(exp.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                        {exp.releaseNotes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {exp.releaseNotes}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tools summary table */}
        {previewExport && previewExport.manifest.tools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Included Tools</CardTitle>
              <CardDescription>
                Actions exported in this MCP package
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewExport.manifest.tools.map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell className="font-medium font-mono text-sm">
                        {tool.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {tool.description}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tool.riskLevel === "irreversible"
                              ? "destructive"
                              : tool.riskLevel === "risky_write"
                              ? "destructive"
                              : tool.riskLevel === "safe_write"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {tool.riskLevel.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tool.requiresConfirmation ? (
                          <Badge variant="outline">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tool.requiresApproval ? (
                          <Badge variant="outline">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* OpenAI Export */}
        <OpenAIExportCard
          exportData={previewExport}
          projectName={currentProject?.name || "My Project"}
        />

        {/* Integration Guide */}
        <IntegrationGuide
          actionRunnerUrl={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/action-runner`}
        />
      </div>
      </ProjectBanner>
    </DashboardLayout>
  );
}
