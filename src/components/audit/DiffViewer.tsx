import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  className?: string;
}

type DiffType = "added" | "removed" | "changed" | "unchanged";

interface DiffEntry {
  key: string;
  type: DiffType;
  beforeValue?: unknown;
  afterValue?: unknown;
}

function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const key of allKeys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    if (beforeValue === undefined && afterValue !== undefined) {
      entries.push({ key, type: "added", afterValue });
    } else if (beforeValue !== undefined && afterValue === undefined) {
      entries.push({ key, type: "removed", beforeValue });
    } else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      entries.push({ key, type: "changed", beforeValue, afterValue });
    } else {
      entries.push({ key, type: "unchanged", beforeValue, afterValue });
    }
  }

  return entries.sort((a, b) => {
    const order: Record<DiffType, number> = { added: 0, removed: 1, changed: 2, unchanged: 3 };
    return order[a.type] - order[b.type];
  });
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const [isOpen, setIsOpen] = useState(entry.type !== "unchanged");
  const isComplex = typeof entry.beforeValue === "object" || typeof entry.afterValue === "object";

  const icon = {
    added: <Plus className="h-3 w-3" />,
    removed: <Minus className="h-3 w-3" />,
    changed: <RefreshCw className="h-3 w-3" />,
    unchanged: null,
  }[entry.type];

  const colors = {
    added: "bg-green-500/10 text-green-600 border-l-2 border-green-500",
    removed: "bg-red-500/10 text-red-600 border-l-2 border-red-500",
    changed: "bg-amber-500/10 text-amber-600 border-l-2 border-amber-500",
    unchanged: "bg-muted/30 text-muted-foreground",
  }[entry.type];

  if (isComplex && entry.type !== "unchanged") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn("w-full justify-start p-2 h-auto rounded-none", colors)}
          >
            {isOpen ? <ChevronDown className="h-3 w-3 mr-2" /> : <ChevronRight className="h-3 w-3 mr-2" />}
            {icon && <span className="mr-2">{icon}</span>}
            <span className="font-mono text-sm">{entry.key}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-8 py-2 bg-muted/20">
          {entry.type !== "added" && entry.beforeValue !== undefined && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground block mb-1">Before:</span>
              <pre className="font-mono text-xs bg-red-500/5 p-2 rounded overflow-auto max-h-32">
                {formatValue(entry.beforeValue)}
              </pre>
            </div>
          )}
          {entry.type !== "removed" && entry.afterValue !== undefined && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">After:</span>
              <pre className="font-mono text-xs bg-green-500/5 p-2 rounded overflow-auto max-h-32">
                {formatValue(entry.afterValue)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={cn("flex items-center justify-between p-2", colors)}>
      <div className="flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span className="font-mono text-sm">{entry.key}</span>
      </div>
      <div className="flex items-center gap-2 text-sm font-mono">
        {entry.type === "changed" && (
          <>
            <span className="text-red-500 line-through">{formatValue(entry.beforeValue)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-green-600">{formatValue(entry.afterValue)}</span>
          </>
        )}
        {entry.type === "added" && <span className="text-green-600">{formatValue(entry.afterValue)}</span>}
        {entry.type === "removed" && <span className="text-red-500">{formatValue(entry.beforeValue)}</span>}
        {entry.type === "unchanged" && <span>{formatValue(entry.beforeValue)}</span>}
      </div>
    </div>
  );
}

export function DiffViewer({ before, after, className }: DiffViewerProps) {
  const entries = computeDiff(before, after);
  const hasChanges = entries.some((e) => e.type !== "unchanged");

  if (!hasChanges) {
    return (
      <div className={cn("text-sm text-muted-foreground p-4 text-center", className)}>
        No changes detected
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border overflow-hidden divide-y", className)}>
      {entries.map((entry) => (
        <DiffRow key={entry.key} entry={entry} />
      ))}
    </div>
  );
}
