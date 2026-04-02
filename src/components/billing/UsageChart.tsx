/**
 * UsageChart component
 * Displays daily usage over time with a bar chart
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { UsageByDay, BillingAccount } from "@/hooks/useBilling";

interface UsageChartProps {
  dailyUsage: UsageByDay[];
  loading: boolean;
  account: BillingAccount | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMicrocents(value: number): string {
  const dollars = value / 100_000;
  if (dollars < 0.01) return `${(value / 100).toFixed(1)}¢`;
  return `$${dollars.toFixed(2)}`;
}

export function UsageChart({ dailyUsage, loading, account }: UsageChartProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (dailyUsage.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>No usage data yet. Usage will appear here once your agents start making tool calls.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = dailyUsage.map((d) => ({
    ...d,
    label: formatDate(d.date),
    costDisplay: formatMicrocents(d.cost_microcents),
  }));

  const totalCalls = dailyUsage.reduce((sum, d) => sum + d.calls, 0);
  const totalCost = dailyUsage.reduce((sum, d) => sum + d.cost_microcents, 0);
  const avgCallsPerDay = Math.round(totalCalls / dailyUsage.length);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Calls (30d)</p>
            <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
            <p className="text-2xl font-bold">{formatMicrocents(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Calls / Day</p>
            <p className="text-2xl font-bold">{avgCallsPerDay.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Tool Calls</CardTitle>
          <CardDescription>Number of MCP tool calls per day over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "cost_microcents") return [formatMicrocents(value), "Cost"];
                    return [value.toLocaleString(), "Calls"];
                  }}
                  labelFormatter={(label: string) => `Date: ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="calls"
                  name="Tool Calls"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
