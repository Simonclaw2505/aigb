/**
 * Settings page for MCP Foundry
 * Organization and account settings
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Building, User, Key, Bell, Trash2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Settings" description="Manage your account and organization">
      <div className="max-w-3xl space-y-6">
        {/* Profile settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your personal account settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  defaultValue={user?.user_metadata?.full_name || ""}
                  placeholder="Your name"
                />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Organization settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Building className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Organization</CardTitle>
                <CardDescription>Manage your workspace settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input id="org-slug" placeholder="acme-corp" />
              </div>
            </div>
            <Button>Update Organization</Button>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">API Keys</CardTitle>
                <CardDescription>Manage API keys for your integrations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Key className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No API keys configured</p>
                <Button variant="outline" className="mt-4" size="sm">
                  Create API Key
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div>
                <p className="font-medium text-sm">Delete Organization</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete this organization and all its data
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
