/**
 * PlanSelector component
 * Displays available billing plans with pricing details
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2 } from "lucide-react";
import type { BillingPlan } from "@/hooks/useBilling";

interface PlanSelectorProps {
  plans: BillingPlan[];
  currentPlanId: string | null;
  loading: boolean;
  onSelectPlan: (planName: string) => void;
  actionLoading: boolean;
}

function formatMicrocents(microcents: number): string {
  const cents = microcents / 100;
  if (cents < 1) return `${microcents} microcents`;
  return `${cents.toFixed(2)}¢`;
}

function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}

export function PlanSelector({
  plans,
  currentPlanId,
  loading,
  onSelectPlan,
  actionLoading,
}: PlanSelectorProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Choose a Plan</h3>
        <p className="text-sm text-muted-foreground">
          Select the plan that best fits your usage. All plans include metered billing for tool calls.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-2 left-4" variant="default">
                  Current Plan
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between capitalize">
                  {plan.name}
                  <span className="text-2xl">{formatCents(plan.base_price_cents)}</span>
                </CardTitle>
                <CardDescription>
                  {plan.base_price_cents > 0 ? "/month" : ""} {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{plan.included_calls.toLocaleString()} calls included/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{formatMicrocents(plan.price_per_call_microcents)} per additional call</span>
                  </li>
                  {plan.price_per_read_microcents != null && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{formatMicrocents(plan.price_per_read_microcents)} for read operations</span>
                    </li>
                  )}
                  {plan.price_per_write_microcents != null && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{formatMicrocents(plan.price_per_write_microcents)} for write operations</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>
                      {plan.max_calls_per_month
                        ? `Up to ${plan.max_calls_per_month.toLocaleString()} calls/month`
                        : "Unlimited calls"}
                    </span>
                  </li>
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || actionLoading}
                  onClick={() => onSelectPlan(plan.name)}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    "Select Plan"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
