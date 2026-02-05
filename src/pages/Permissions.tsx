/**
 * Permissions page for MCP Foundry
 * Configure role-based access control for MCP actions
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Lock } from "lucide-react";

// Available roles
const roles = ["owner", "admin", "member", "viewer"] as const;

export default function Permissions() {
  // TODO: Fetch from database
  const actions: any[] = [];

  return (
    <DashboardLayout title="Permissions" description="Configure role-based access for actions">
      <div className="space-y-6">
        {/* Role overview */}
        <div className="grid gap-4 md:grid-cols-4">
          {roles.map((role) => (
            <Card key={role} className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    {role === "owner" ? (
                      <Lock className="h-5 w-5 text-primary" />
                    ) : role === "admin" ? (
                      <Shield className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium capitalize">{role}</p>
                    <p className="text-xs text-muted-foreground">
                      {role === "owner"
                        ? "Full access"
                        : role === "admin"
                        ? "Manage resources"
                        : role === "member"
                        ? "Execute actions"
                        : "View only"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions matrix */}
        {actions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No actions to configure</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Import an API and generate actions to configure permissions
              </p>
              <Button variant="outline" asChild>
                <a href="/import">Import API</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permission Matrix</CardTitle>
              <CardDescription>
                Configure which roles can execute each action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role} className="text-center capitalize">
                        {role}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {action.method}
                          </Badge>
                          <span className="font-medium">{action.name}</span>
                        </div>
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role} className="text-center">
                          <Checkbox
                            checked={role === "owner" || role === "admin"}
                            disabled={role === "owner"}
                          />
                        </TableCell>
                      ))}
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
