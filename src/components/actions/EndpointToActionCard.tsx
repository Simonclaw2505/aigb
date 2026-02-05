/**
 * Endpoint to Action Card
 * Displays an endpoint with option to convert to action
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wand2, Check, ChevronRight, AlertTriangle } from "lucide-react";
import type { RiskLevel } from "@/lib/action-suggestions";

interface EndpointToActionCardProps {
  endpoint: {
    id: string;
    method: string;
    path: string;
    name: string;
    description: string | null;
    isDeprecated: boolean;
    hasAction: boolean;
  };
  suggestedRisk: RiskLevel;
  onConvert: () => void;
  onView: () => void;
}

// Method badge colors
const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PATCH: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
};

// Risk level indicators
const riskIndicators: Record<RiskLevel, { color: string; label: string }> = {
  read_only: { color: "bg-emerald-500", label: "Read" },
  safe_write: { color: "bg-blue-500", label: "Safe" },
  risky_write: { color: "bg-amber-500", label: "Risky" },
  irreversible: { color: "bg-red-500", label: "Critical" },
};

export function EndpointToActionCard({
  endpoint,
  suggestedRisk,
  onConvert,
  onView,
}: EndpointToActionCardProps) {
  const riskInfo = riskIndicators[suggestedRisk];

  return (
    <Card
      className={`transition-all hover:shadow-md ${
        endpoint.hasAction ? "border-primary/30 bg-primary/5" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Method badge */}
          <Badge
            variant="outline"
            className={`font-mono text-xs shrink-0 ${methodColors[endpoint.method] || ""}`}
          >
            {endpoint.method}
          </Badge>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-medium truncate">
                {endpoint.path}
              </code>
              {endpoint.isDeprecated && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Deprecated endpoint</TooltipContent>
                </Tooltip>
              )}
              {endpoint.hasAction && (
                <Tooltip>
                  <TooltipTrigger>
                    <Check className="h-4 w-4 text-emerald-500" />
                  </TooltipTrigger>
                  <TooltipContent>Action created</TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {endpoint.description || endpoint.name}
            </p>
          </div>

          {/* Risk indicator */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${riskInfo.color}`} />
                <span className="text-xs text-muted-foreground">{riskInfo.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Suggested risk: {suggestedRisk.replace("_", " ")}</TooltipContent>
          </Tooltip>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {endpoint.hasAction ? (
              <Button variant="ghost" size="sm" onClick={onView}>
                View
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={onConvert}>
                <Wand2 className="h-4 w-4 mr-2" />
                Create Action
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
