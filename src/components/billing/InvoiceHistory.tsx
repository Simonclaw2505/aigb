/**
 * InvoiceHistory component
 * Displays list of past invoices with PDF download links
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import type { BillingInvoice } from "@/hooks/useBilling";

interface InvoiceHistoryProps {
  invoices: BillingInvoice[];
  loading: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  open: "secondary",
  draft: "outline",
  void: "outline",
  uncollectible: "destructive",
};

export function InvoiceHistory({ invoices, loading }: InvoiceHistoryProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            No invoices yet. Your first invoice will appear after your first billing period.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>View and download your past invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Period</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Calls</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatCents(invoice.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    {invoice.total_calls.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"}>
                      {invoice.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.pdf_url!, "_blank")}
                        >
                          <FileText className="mr-1 h-4 w-4" />
                          PDF
                        </Button>
                      )}
                      {invoice.hosted_invoice_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.hosted_invoice_url!, "_blank")}
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
