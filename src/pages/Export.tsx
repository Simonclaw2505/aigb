/**
 * Export page for MCP Foundry
 * Generate and download MCP configuration files
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Download, FileJson, FileCode, Copy, Check, Package } from "lucide-react";

export default function Export() {
  const [format, setFormat] = useState("json");
  const [includeAuth, setIncludeAuth] = useState(true);
  const [includeSchemas, setIncludeSchemas] = useState(true);
  const [copied, setCopied] = useState(false);

  // TODO: Check if project has actions
  const hasActions = false;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout title="Export" description="Generate MCP configuration for your AI agents">
      <div className="max-w-3xl space-y-6">
        {/* Export options */}
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
              <RadioGroup value={format} onValueChange={setFormat} className="grid grid-cols-2 gap-4">
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
                  <RadioGroupItem value="typescript" id="typescript" className="peer sr-only" />
                  <Label
                    htmlFor="typescript"
                    className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <FileCode className="mb-3 h-6 w-6" />
                    <span className="font-medium">TypeScript</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Type-safe SDK
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
                <Switch checked={includeSchemas} onCheckedChange={setIncludeSchemas} />
              </div>
            </div>

            <Separator />

            {/* Export buttons */}
            <div className="flex gap-4">
              <Button className="flex-1" disabled={!hasActions}>
                <Download className="mr-2 h-4 w-4" />
                Download {format === "json" ? ".json" : ".ts"}
              </Button>
              <Button variant="outline" onClick={handleCopy} disabled={!hasActions}>
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
          </CardContent>
        </Card>

        {/* Preview or empty state */}
        {!hasActions ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nothing to export</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Import an API and configure actions before exporting
              </p>
              <Button variant="outline" asChild>
                <a href="/import">Import API</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Generated MCP configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted font-mono text-sm overflow-auto max-h-[400px]">
                {format === "json"
                  ? JSON.stringify({ tools: [], schemas: {} }, null, 2)
                  : "// TypeScript SDK export\nexport const mcpTools = {};"
                }
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
