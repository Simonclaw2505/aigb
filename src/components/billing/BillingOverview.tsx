/**
 * BillingOverview component
 * Shows current billing status, plan, usage summary, and payment controls
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { BillingAccount } from "@/hooks/useBilling";

interface BillingOverviewProps {
  account: BillingAccount | null;
  onSetupBilling: () => void;
  onOpenPortal: () => void;
  onRefresh: () => void;
  actionLoading: boolean;
}

function formatMicrocents(microcents: number): string {
  const dollars = microcents / 100_000;
  if (dollars < 0.01) return `${(microcents / 100).toFixed(2)}¢`;
  return `$${dollars.toFixed(2)}`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  active: { label: "Active", variant: "default", icon: CheckCircle },
  inactive: { label: "Inactive", variant: "secondary", icon: AlertTriangle },
  past_due: { label: "Past Due", variant: "destructive", icon: AlertTriangle },
  suspended: { label: "Suspended", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "outline", icon: AlertTriangle },
};

export function BillingOverview({
  account,
  onSetupBilling,
  onOpenPortal,
  onRefresh,
  actionLoading,
}: BillingOverviewProps) {
  // No billing account — show setup CTA
  if (!account) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Set Up Billing</CardTitle>
            <CardDescription>
              Connect a payment method to enable MCP tool calls for your agents.
              Without billing, agents will receive HTTP 402 responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={onSetupBilling} disabled={actionLoading} size="lg">
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Set Up Payment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = account.billing_plans;
  const statusConfig = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.inactive;
  const StatusIcon = statusConfig.icon;

  const callsUsed = account.total_calls_this_period;
  const includedCalls = plan?.included_calls ?? 0;
  const maxCalls = plan?.max_calls_per_month;
  const usagePercent = maxCalls ? Math.min(100, (callsUsed / maxCalls) * 100) : (includedCalls > 0 ? Math.min(100, (callsUsed / includedCalls) * 100) : 0);

  const periodEnd = account.current_period_end
    ? new Date(account.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="space-y-6">
      {/* Status banner for non-active accounts */}
      {account.status === "past_due" && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Payment Failed</p>
              <p className="text-sm text-muted-foreground">
                Your last payment failed. Update your payment method to continue using MCP tools.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={onOpenPortal}>
              Update Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main stats grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Plan card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Badge variant={statusConfig.variant}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{plan?.name ?? "No Plan"}</div>
            <p className="text-xs text-muted-foreground">
              {plan ? `${formatCents(plan.base_price_cents)}/month + ${formatMicrocents(plan.price_per_call_microcents)}/call` : "Select a plan to get started"}
            </p>
          </CardContent>
        </Card>

        {/* Usage card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls This Period</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsUsed.toLocaleString()}</div>
            <div className="mt-2 space-y-1">
              <Progress value={usagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {includedCalls > 0
                  ? `${Math.max(0, includedCalls - callsUsed).toLocaleString()} included calls remaining`
                  : "No included calls"}
                {maxCalls ? ` · ${maxCalls.toLocaleString()} max` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost This Period</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicrocents(account.total_cost_microcents_this_period)}
            </div>
            <p className="text-xs text-muted-foreground">
              {plan ? `+ ${formatCents(plan.base_price_cents)} base` : ""} · Resets {periodEnd}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage Billing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onOpenPortal} disabled={actionLoading}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Stripe Customer Portal
          </Button>
          <Button variant="ghost" onClick={onRefresh} disabled={actionLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {account.billing_email && (
            <p className="flex items-center text-sm text-muted-foreground ml-auto">
              Billing email: {account.billing_email}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
