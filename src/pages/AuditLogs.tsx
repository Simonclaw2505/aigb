/**
 * Audit Logs page for MCP Foundry
 * View all activity and changes across the organization
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Download, RefreshCw, Calendar, User, Activity, Clock } from "lucide-react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { ExecutionTimeline } from "@/components/audit/ExecutionTimeline";
import { useAuth } from "@/hooks/useAuth";

// Action type badge colors
const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-600 border-green-500/20",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  execute: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  export: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("trail");

  const { organizationId } = useAuth();

  const { auditLogs, executionRuns, isLoading, refetch } = useAuditLogs(organizationId, {
    searchQuery: searchQuery || undefined,
    resourceType: resourceFilter !== "all" ? resourceFilter : undefined,
  });

  const handleExport = () => {
    const data = activeTab === "trail" ? auditLogs : executionRuns;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Audit Logs" description="Track all activity in your organization">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="action">Actions</SelectItem>
                <SelectItem value="permission">Permissions</SelectItem>
                <SelectItem value="export">Exports</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="trail" className="gap-2">
              <FileText className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Activity className="h-4 w-4" />
              Execution Timeline
            </TabsTrigger>
          </TabsList>

          {/* Audit Trail Tab */}
          <TabsContent value="trail" className="mt-6">
            {auditLogs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No audit logs yet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Activity in your organization will appear here for compliance and debugging
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activity Log</CardTitle>
                  <CardDescription>
                    Showing {auditLogs.length} log entries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{log.user_id ? "User" : "System"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={actionColors[log.action] || ""}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.resource_type}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {log.metadata ? JSON.stringify(log.metadata) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Execution Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            {executionRuns.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No executions yet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Action executions will appear here with detailed timelines and rollback options
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ExecutionTimeline executions={executionRuns} onRollbackSuccess={refetch} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
