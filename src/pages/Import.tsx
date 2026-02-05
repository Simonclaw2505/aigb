/**
 * API Import page for MCP Foundry
 * Import OpenAPI specifications via file upload or URL
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, FileJson, CheckCircle, AlertCircle } from "lucide-react";

export default function Import() {
  const [specUrl, setSpecUrl] = useState("");
  const [specJson, setSpecJson] = useState("");

  return (
    <DashboardLayout title="API Import" description="Import your OpenAPI specification">
      <div className="max-w-3xl space-y-6">
        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 py-4">
            <FileJson className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Supported Formats</p>
              <p className="text-sm text-muted-foreground mt-1">
                OpenAPI 3.0+, Swagger 2.0 (JSON or YAML)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Import methods */}
        <Card>
          <CardHeader>
            <CardTitle>Import OpenAPI Specification</CardTitle>
            <CardDescription>
              Choose how you'd like to import your API specification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="url">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="paste">
                  <FileJson className="h-4 w-4 mr-2" />
                  Paste
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="spec-url">Specification URL</Label>
                  <Input
                    id="spec-url"
                    type="url"
                    placeholder="https://api.example.com/openapi.json"
                    value={specUrl}
                    onChange={(e) => setSpecUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The URL should return a valid OpenAPI document
                  </p>
                </div>
                <Button className="w-full" disabled={!specUrl}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Fetch Specification
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium text-sm mb-1">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports .json and .yaml files up to 5MB
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="spec-json">Specification (JSON/YAML)</Label>
                  <Textarea
                    id="spec-json"
                    placeholder='{"openapi": "3.0.0", ...}'
                    value={specJson}
                    onChange={(e) => setSpecJson(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
                <Button className="w-full" disabled={!specJson}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Parse Specification
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Validation status placeholder */}
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Import a specification to see validation results
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
