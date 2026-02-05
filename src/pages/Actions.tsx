/**
 * Actions page for MCP Foundry
 * View and manage generated MCP actions from the imported API
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Play, Settings, Zap } from "lucide-react";
import { useState } from "react";

// Method badge colors
const methodColors: Record<string, string> = {
  GET: "bg-green-500/10 text-green-600 border-green-500/20",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PATCH: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function Actions() {
  const [searchQuery, setSearchQuery] = useState("");

  // TODO: Fetch from database
  const actions: any[] = [];

  return (
    <DashboardLayout title="Actions" description="Manage MCP actions generated from your API">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configure All
            </Button>
          </div>
        </div>

        {/* Actions table or empty state */}
        {actions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No actions yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Import an OpenAPI specification to generate MCP actions
              </p>
              <Button variant="outline" asChild>
                <a href="/import">Import API</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated Actions</CardTitle>
              <CardDescription>
                {actions.length} action{actions.length !== 1 ? "s" : ""} available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <Switch checked={action.is_enabled} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={methodColors[action.method]}>
                          {action.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{action.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {action.path}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {action.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
