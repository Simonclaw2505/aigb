import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Loader2, Bot } from "lucide-react";

interface LinkedAgent {
  id: string;
  name: string;
}

interface ManageToolAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: string;
  toolName: string;
  organizationId: string;
  onChanged: () => void;
}

export function ManageToolAgentsDialog({
  open,
  onOpenChange,
  toolId,
  toolName,
  organizationId,
  onChanged,
}: ManageToolAgentsDialogProps) {
  const [linkedAgents, setLinkedAgents] = useState<LinkedAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<LinkedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [{ data: links }, { data: allAgents }] = await Promise.all([
        supabase
          .from("agent_tools")
          .select("agent_id, projects:agent_id(id, name)")
          .eq("api_source_id", toolId),
        supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", organizationId),
      ]);

      const linked = (links || []).map((l: any) => ({
        id: l.projects.id,
        name: l.projects.name,
      }));
      setLinkedAgents(linked);

      const linkedIds = new Set(linked.map((a) => a.id));
      setAvailableAgents(
        (allAgents || []).filter((a) => !linkedIds.has(a.id))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [open, toolId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!selectedAgentId) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("agent_tools")
        .insert({ agent_id: selectedAgentId, api_source_id: toolId });
      if (error) throw error;
      toast.success("Agent ajouté");
      setSelectedAgentId("");
      await fetchData();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (agentId: string) => {
    setRemovingId(agentId);
    try {
      const { error } = await supabase
        .from("agent_tools")
        .delete()
        .eq("agent_id", agentId)
        .eq("api_source_id", toolId);
      if (error) throw error;
      toast.success("Agent retiré");
      await fetchData();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agents utilisant {toolName}
          </DialogTitle>
          <DialogDescription>
            Gérez les agents liés à cet outil
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Agents liés</p>
              {linkedAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun agent lié</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {linkedAgents.map((agent) => (
                    <Badge
                      key={agent.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {agent.name}
                      <button
                        onClick={() => handleRemove(agent.id)}
                        disabled={removingId === agent.id}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        {removingId === agent.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {availableAgents.length > 0 && (
              <div className="flex gap-2">
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choisir un agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedAgentId || adding}
                  size="sm"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
