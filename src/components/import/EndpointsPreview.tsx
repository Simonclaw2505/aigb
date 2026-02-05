/**
 * Endpoints Preview Table Component
 * Displays parsed endpoints with search, filter, and method badges
 */

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Filter, AlertTriangle, Check, X } from "lucide-react";
import type { ParsedEndpoint } from "@/lib/openapi-parser";

interface EndpointsPreviewProps {
  endpoints: ParsedEndpoint[];
  selectedEndpoints: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

// Method badge color classes
const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PATCH: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
  HEAD: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  OPTIONS: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export function EndpointsPreview({
  endpoints,
  selectedEndpoints,
  onSelectionChange,
}: EndpointsPreviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  // Extract unique tags from endpoints
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    endpoints.forEach((ep) => ep.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [endpoints]);

  // Filter endpoints based on search and filters
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        ep.name.toLowerCase().includes(searchLower) ||
        ep.path.toLowerCase().includes(searchLower) ||
        ep.description?.toLowerCase().includes(searchLower) ||
        ep.operationId?.toLowerCase().includes(searchLower);

      // Method filter
      const matchesMethod = methodFilter === "all" || ep.method === methodFilter;

      // Tag filter
      const matchesTag = tagFilter === "all" || ep.tags.includes(tagFilter);

      return matchesSearch && matchesMethod && matchesTag;
    });
  }, [endpoints, searchQuery, methodFilter, tagFilter]);

  // Generate a unique key for an endpoint
  const getEndpointKey = (ep: ParsedEndpoint) => `${ep.method}:${ep.path}`;

  // Toggle selection for a single endpoint
  const toggleEndpoint = (ep: ParsedEndpoint) => {
    const key = getEndpointKey(ep);
    const newSelected = new Set(selectedEndpoints);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange(newSelected);
  };

  // Toggle all visible endpoints
  const toggleAllVisible = () => {
    const visibleKeys = filteredEndpoints.map(getEndpointKey);
    const allSelected = visibleKeys.every((key) => selectedEndpoints.has(key));

    const newSelected = new Set(selectedEndpoints);
    if (allSelected) {
      visibleKeys.forEach((key) => newSelected.delete(key));
    } else {
      visibleKeys.forEach((key) => newSelected.add(key));
    }
    onSelectionChange(newSelected);
  };

  const allVisibleSelected =
    filteredEndpoints.length > 0 &&
    filteredEndpoints.every((ep) => selectedEndpoints.has(getEndpointKey(ep)));

  const someVisibleSelected =
    filteredEndpoints.some((ep) => selectedEndpoints.has(getEndpointKey(ep))) &&
    !allVisibleSelected;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selection summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredEndpoints.length} of {endpoints.length} endpoints shown
        </span>
        <span>
          {selectedEndpoints.size} selected for import
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = someVisibleSelected;
                    }
                  }}
                  onCheckedChange={toggleAllVisible}
                  aria-label="Select all visible"
                />
              </TableHead>
              <TableHead className="w-[100px]">Method</TableHead>
              <TableHead className="w-[250px]">Path</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px]">Parameters</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEndpoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No endpoints match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredEndpoints.map((ep) => {
                const key = getEndpointKey(ep);
                const isSelected = selectedEndpoints.has(key);
                const paramCount =
                  ep.pathParameters.length +
                  ep.queryParameters.length +
                  ep.headerParameters.length;
                const hasBody = ep.requestBodySchema !== null;

                return (
                  <TableRow
                    key={key}
                    className={isSelected ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEndpoint(ep)}
                        aria-label={`Select ${ep.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs ${methodColors[ep.method]}`}
                      >
                        {ep.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono text-foreground">
                        {ep.path}
                      </code>
                      {ep.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {ep.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {ep.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              +{ep.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ep.description || ep.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {paramCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="bg-muted px-1.5 py-0.5 rounded">
                                {paramCount} param{paramCount !== 1 ? "s" : ""}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                {ep.pathParameters.length > 0 && (
                                  <div>Path: {ep.pathParameters.map((p) => p.name).join(", ")}</div>
                                )}
                                {ep.queryParameters.length > 0 && (
                                  <div>Query: {ep.queryParameters.map((p) => p.name).join(", ")}</div>
                                )}
                                {ep.headerParameters.length > 0 && (
                                  <div>Header: {ep.headerParameters.map((p) => p.name).join(", ")}</div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {hasBody && (
                          <span className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">
                            body
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ep.isDeprecated ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>Deprecated</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
