/**
 * Dialog for creating a new agent API key
 * Shows the raw key once after creation
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, AlertTriangle, Key, Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onCreateKey: (params: {
    projectId: string;
    name: string;
    rateLimitPerHour?: number;
  }) => Promise<{ rawKey: string } | null>;
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  projects,
  onCreateKey,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !projectId) return;
    setCreating(true);
    const result = await onCreateKey({
      projectId,
      name: name.trim(),
      rateLimitPerHour: rateLimit ? parseInt(rateLimit) : undefined,
    });
    setCreating(false);
    if (result) {
      setRawKey(result.rawKey);
    }
  };

  const handleCopy = async () => {
    if (rawKey) {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setName("");
    setProjectId("");
    setRateLimit("");
    setRawKey(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={rawKey ? handleClose : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {rawKey ? "API Key Created" : "Create API Key"}
          </DialogTitle>
          <DialogDescription>
            {rawKey
              ? "Copy the key below. It won't be shown again."
              : "Create an API key for an AI agent to authenticate with MCP Foundry."}
          </DialogDescription>
        </DialogHeader>

        {rawKey ? (
          <div className="space-y-4">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                This key will only be shown once. Copy it now and store it securely.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Input
                readOnly
                value={rawKey}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Agent Compta Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate-limit">
                Rate Limit (requests/hour){" "}
                <span className="text-muted-foreground font-normal">— optional</span>
              </Label>
              <Input
                id="rate-limit"
                type="number"
                placeholder="e.g. 100"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || !projectId || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Key"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
