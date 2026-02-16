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
import { X, Plus, Loader2, Wrench } from "lucide-react";

interface LinkedTool {
  id: string;
  name: string;
}

interface ManageAgentToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  organizationId: string;
  onChanged: () => void;
}

export function ManageAgentToolsDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  organizationId,
  onChanged,
}: ManageAgentToolsDialogProps) {
  const [linkedTools, setLinkedTools] = useState<LinkedTool[]>([]);
  const [availableTools, setAvailableTools] = useState<LinkedTool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [{ data: links }, { data: allTools }] = await Promise.all([
        supabase
          .from("agent_tools")
          .select("api_source_id, api_sources(id, name)")
          .eq("agent_id", agentId),
        supabase
          .from("api_sources")
          .select("id, name")
          .eq("organization_id", organizationId),
      ]);

      const linked = (links || []).map((l: any) => ({
        id: l.api_sources.id,
        name: l.api_sources.name,
      }));
      setLinkedTools(linked);

      const linkedIds = new Set(linked.map((t) => t.id));
      setAvailableTools(
        (allTools || []).filter((t) => !linkedIds.has(t.id))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [open, agentId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!selectedToolId) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("agent_tools")
        .insert({ agent_id: agentId, api_source_id: selectedToolId });
      if (error) throw error;
      toast.success("Outil ajouté");
      setSelectedToolId("");
      await fetchData();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (toolId: string) => {
    setRemovingId(toolId);
    try {
      const { error } = await supabase
        .from("agent_tools")
        .delete()
        .eq("agent_id", agentId)
        .eq("api_source_id", toolId);
      if (error) throw error;
      toast.success("Outil retiré");
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
            <Wrench className="h-5 w-5" />
            Outils de {agentName}
          </DialogTitle>
          <DialogDescription>
            Gérez les outils API liés à cet agent
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Linked tools */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Outils liés</p>
              {linkedTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun outil lié</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {linkedTools.map((tool) => (
                    <Badge
                      key={tool.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {tool.name}
                      <button
                        onClick={() => handleRemove(tool.id)}
                        disabled={removingId === tool.id}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        {removingId === tool.id ? (
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

            {/* Add tool */}
            {availableTools.length > 0 && (
              <div className="flex gap-2">
                <Select
                  value={selectedToolId}
                  onValueChange={setSelectedToolId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choisir un outil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTools.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedToolId || adding}
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
