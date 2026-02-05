/**
 * Simulator page for MCP Foundry
 * Test MCP actions in a sandbox environment
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TestTube, Play, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Simulator() {
  const [selectedAction, setSelectedAction] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // TODO: Fetch from database
  const actions: any[] = [];

  return (
    <DashboardLayout title="Simulator" description="Test your MCP actions in a sandbox">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request</CardTitle>
            <CardDescription>Configure and execute an action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Action</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an action to test" />
                </SelectTrigger>
                <SelectContent>
                  {actions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No actions available
                    </SelectItem>
                  ) : (
                    actions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {action.method}
                          </Badge>
                          {action.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Parameters (JSON)</Label>
              <Textarea
                placeholder='{"key": "value"}'
                rows={6}
                className="font-mono text-sm"
                disabled={!selectedAction}
              />
            </div>

            <div className="space-y-2">
              <Label>Headers (Optional)</Label>
              <Input
                placeholder='{"Authorization": "Bearer ..."}'
                className="font-mono text-sm"
                disabled={!selectedAction}
              />
            </div>

            <Button className="w-full" disabled={!selectedAction || isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Action
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Response panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Response</CardTitle>
            <CardDescription>View execution results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <TestTube className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Execute an action to see the response
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Execution history */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Execution History</CardTitle>
            <CardDescription>Recent test executions in this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No executions yet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
