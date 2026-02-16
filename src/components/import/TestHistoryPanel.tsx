/**
 * Test History Panel
 * Displays a scrollable log of API test results with method badges, status, and collapsible response bodies.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2, Clock } from "lucide-react";

export interface TestHistoryEntry {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  success: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
  error?: string;
  durationMs: number;
}

interface TestHistoryPanelProps {
  history: TestHistoryEntry[];
  onClear: () => void;
  methodColors: Record<string, string>;
}

export function TestHistoryPanel({ history, onClear, methodColors }: TestHistoryPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (history.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const isWriteMethod = (method: string) => ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">
              Historique des tests{" "}
              <span className="text-muted-foreground font-normal">({history.length})</span>
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs text-muted-foreground">
            <Trash2 className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[350px]">
          <div className="space-y-2">
            {history.map((entry) => (
              <Collapsible
                key={entry.id}
                open={expandedIds.has(entry.id)}
                onOpenChange={() => toggleExpand(entry.id)}
              >
                <div className="rounded-lg border bg-card">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full p-3 text-left hover:bg-muted/50 transition-colors rounded-lg">
                      {expandedIds.has(entry.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}

                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${methodColors[entry.method] || ""}`}>
                        {entry.method}
                      </Badge>

                      <code className="text-xs font-mono truncate flex-1">{entry.path || "/"}</code>

                      {entry.success ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">
                            {entry.status}
                            {isWriteMethod(entry.method) && " — Action effectuée"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-xs text-destructive font-medium">
                            {entry.status ? `${entry.status}` : "Erreur"}
                            {isWriteMethod(entry.method) && " — Échec"}
                          </span>
                        </div>
                      )}

                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {entry.durationMs}ms · {formatTime(entry.timestamp)}
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-0">
                      {entry.error && (
                        <p className="text-xs text-destructive mb-2">{entry.error}</p>
                      )}
                      {entry.body != null && (
                        <pre className="bg-muted rounded-md p-2 text-[11px] font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all">
                          {typeof entry.body === "string"
                            ? entry.body
                            : JSON.stringify(entry.body, null, 2)}
                        </pre>
                      )}
                      {!entry.error && entry.body == null && (
                        <p className="text-xs text-muted-foreground italic">Aucun corps de réponse</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
