/**
 * Card for exporting in OpenAI tools/functions format
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, Check, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MCPExport } from "@/hooks/useExport";

interface OpenAIExportCardProps {
  exportData: MCPExport | null;
  projectName: string;
}

function buildOpenAIExport(exportData: MCPExport, projectName: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const tools = exportData.manifest.tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));

  return {
    _comment: `MCP Foundry export for "${projectName}" — OpenAI function calling format`,
    server: {
      base_url: `${supabaseUrl}/functions/v1/action-runner`,
      auth_header: "X-API-Key",
      auth_value: "<YOUR_API_KEY_HERE>",
    },
    instructions: `You are an AI agent connected to "${projectName}" via MCP Foundry. When the user asks you to perform an action, use the functions below. Each function call sends a POST to the action-runner endpoint with the body: { "action_template_id": "<id>", "inputs": { ...params } }. Authenticate with the X-API-Key header.`,
    action_template_ids: Object.fromEntries(
      exportData.manifest.tools.map((tool) => [tool.name, "< paste action_template_id >"])
    ),
    tools,
  };
}

export function OpenAIExportCard({ exportData, projectName }: OpenAIExportCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!exportData) return null;

  const openaiExport = buildOpenAIExport(exportData, projectName);
  const content = JSON.stringify(openaiExport, null, 2);

  const handleDownload = () => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openai-tools-${projectName.toLowerCase().replace(/\s+/g, "-")}-v${exportData.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "OpenAI tools JSON downloaded" });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "OpenAI tools JSON copied" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                OpenAI / Claude Export
                <Badge variant="secondary">Function Calling</Badge>
              </CardTitle>
              <CardDescription>
                Ready-to-use tools definition for AI agents
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download this JSON and use it in your OpenAI Assistant, GPT, or Claude agent
          configuration. Replace <code className="bg-muted px-1 rounded text-xs">&lt;YOUR_API_KEY_HERE&gt;</code> with
          an API key from Settings → API Keys.
        </p>

        <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-auto max-h-[300px]">
          {content}
        </pre>

        <div className="flex gap-2">
          <Button onClick={handleDownload} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Download OpenAI Tools JSON
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
