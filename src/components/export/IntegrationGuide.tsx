/**
 * Step-by-step integration guide for connecting agents to MCP Foundry
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface IntegrationGuideProps {
  actionRunnerUrl: string;
}

export function IntegrationGuide({ actionRunnerUrl }: IntegrationGuideProps) {
  const pythonSnippet = `import requests

API_KEY = "mcpf_your_key_here"
ACTION_RUNNER = "${actionRunnerUrl}"

response = requests.post(
    ACTION_RUNNER,
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    },
    json={
        "action_template_id": "your-action-id",
        "inputs": {"param1": "value1"},
    },
)
print(response.json())`;

  const jsSnippet = `const response = await fetch("${actionRunnerUrl}", {
  method: "POST",
  headers: {
    "X-API-Key": "mcpf_your_key_here",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action_template_id: "your-action-id",
    inputs: { param1: "value1" },
  }),
});
const data = await response.json();`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Integration Guide</CardTitle>
            <CardDescription>
              Connect your AI agent to MCP Foundry in 4 steps
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Steps */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</Badge>
            <div>
              <p className="font-medium text-sm">Create an API Key</p>
              <p className="text-xs text-muted-foreground">
                Go to Settings → API Keys → Create Key. Choose the project and copy the key.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</Badge>
            <div>
              <p className="font-medium text-sm">Download the OpenAI Export</p>
              <p className="text-xs text-muted-foreground">
                Click "Download OpenAI Tools JSON" above. This file contains your tool definitions.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</Badge>
            <div>
              <p className="font-medium text-sm">Replace the API key placeholder</p>
              <p className="text-xs text-muted-foreground">
                In the downloaded JSON, replace <code className="bg-muted px-1 rounded">&lt;YOUR_API_KEY_HERE&gt;</code> with your actual key.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</Badge>
            <div>
              <p className="font-medium text-sm">Configure your agent</p>
              <p className="text-xs text-muted-foreground">
                Paste the <code className="bg-muted px-1 rounded">tools</code> array into your OpenAI Assistant or Claude configuration. The agent will call action-runner automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Code snippets */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Direct API Call — Python</p>
          <pre className="p-3 rounded-lg bg-muted font-mono text-xs overflow-auto max-h-[200px]">
            {pythonSnippet}
          </pre>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Direct API Call — JavaScript</p>
          <pre className="p-3 rounded-lg bg-muted font-mono text-xs overflow-auto max-h-[200px]">
            {jsSnippet}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
