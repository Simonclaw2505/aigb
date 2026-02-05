/**
 * Action Card Component
 * Displays an existing action with edit/delete options
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Play,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { RiskLevel } from "@/lib/action-suggestions";

interface ActionCardProps {
  action: {
    id: string;
    name: string;
    description: string;
    riskLevel: RiskLevel;
    isEnabled: boolean;
    isIdempotent: boolean;
    requiresApproval: boolean;
    version: number;
    endpointMethod: string;
    endpointPath: string;
    executionCount?: number;
    lastExecuted?: string;
  };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

// Risk level configuration
const RISK_CONFIG: Record<RiskLevel, { icon: React.ElementType; color: string; bgColor: string }> = {
  read_only: { icon: ShieldCheck, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  safe_write: { icon: Shield, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  risky_write: { icon: ShieldAlert, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  irreversible: { icon: ShieldX, color: "text-red-500", bgColor: "bg-red-500/10" },
};

export function ActionCard({
  action,
  onEdit,
  onDuplicate,
  onDelete,
  onTest,
  onToggleEnabled,
}: ActionCardProps) {
  const riskConfig = RISK_CONFIG[action.riskLevel];
  const RiskIcon = riskConfig.icon;

  return (
    <Card className={`transition-all ${!action.isEnabled ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Risk indicator */}
            <div className={`p-2 rounded-lg ${riskConfig.bgColor}`}>
              <RiskIcon className={`h-4 w-4 ${riskConfig.color}`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-medium">{action.name}</h3>
                <Badge variant="outline" className="text-xs">
                  v{action.version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {action.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={action.isEnabled}
              onCheckedChange={onToggleEnabled}
              aria-label="Toggle action"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTest}>
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Endpoint binding */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="font-mono text-xs">
            {action.endpointMethod}
          </Badge>
          <code className="text-xs text-muted-foreground truncate">
            {action.endpointPath}
          </code>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {action.isIdempotent && (
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                <span>Idempotent</span>
              </TooltipTrigger>
              <TooltipContent>Safe to retry</TooltipContent>
            </Tooltip>
          )}
          {action.requiresApproval && (
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Approval</span>
              </TooltipTrigger>
              <TooltipContent>Requires human approval</TooltipContent>
            </Tooltip>
          )}
          {action.executionCount !== undefined && (
            <span>{action.executionCount} executions</span>
          )}
          {action.lastExecuted && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(action.lastExecuted).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
