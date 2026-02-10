/**
 * Panel for managing agent API keys in Settings
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Key, Plus, Loader2, Ban, Trash2 } from "lucide-react";
import { useAgentApiKeys } from "@/hooks/useAgentApiKeys";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import { formatDistanceToNow } from "date-fns";

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

interface AgentApiKeysPanelProps {
  organizationId: string | null;
  projects: Project[];
}

export function AgentApiKeysPanel({ organizationId, projects }: AgentApiKeysPanelProps) {
  const { keys, loading, fetchKeys, createKey, revokeKey, deleteKey } =
    useAgentApiKeys({ organizationId });
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) fetchKeys();
  }, [organizationId, fetchKeys]);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Key className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No organization found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Agent API Keys</CardTitle>
                <CardDescription>
                  API keys for AI agents to authenticate with your MCP server
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Key className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No API keys yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create one to let agents call your actions
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {k.keyPrefix}...
                    </TableCell>
                    <TableCell className="text-sm">
                      {projectMap[k.projectId] || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{k.usageCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.lastUsedAt
                        ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {k.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Revoked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeId(k.id)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKey(k.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        onCreateKey={createKey}
      />

      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately disable this key. Any agent using it will lose access.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeId) revokeKey(revokeId);
                setRevokeId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
