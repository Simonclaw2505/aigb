/**
 * Import Errors Display Component
 * Shows validation errors and warnings from OpenAPI parsing
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import type { ParseError } from "@/lib/openapi-parser";

interface ImportErrorsProps {
  errors: ParseError[];
}

export function ImportErrors({ errors }: ImportErrorsProps) {
  if (errors.length === 0) {
    return (
      <Alert className="border-emerald-500/50 bg-emerald-500/5">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <AlertTitle className="text-emerald-600">Validation Passed</AlertTitle>
        <AlertDescription className="text-emerald-600/80">
          The specification was parsed successfully with no errors.
        </AlertDescription>
      </Alert>
    );
  }

  const criticalErrors = errors.filter((e) => e.severity === "error");
  const warnings = errors.filter((e) => e.severity === "warning");

  return (
    <div className="space-y-3">
      {criticalErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {criticalErrors.length} Error{criticalErrors.length !== 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {criticalErrors.map((error, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-destructive/20 px-1 rounded shrink-0">
                    {error.path}
                  </span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">
            {warnings.length} Warning{warnings.length !== 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription className="text-amber-600/80">
            <ul className="mt-2 space-y-1 text-sm">
              {warnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-amber-500/20 px-1 rounded shrink-0">
                    {warning.path}
                  </span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
