/**
 * Billing Report Usage Edge Function - AIGB
 * Cron job that aggregates unreported usage records and sends them to Stripe.
 *
 * Should be called via Supabase pg_cron or external cron every hour.
 * Can also be called manually for immediate reporting.
 *
 * Flow:
 *   1. SELECT usage_records WHERE reported_to_stripe = false, GROUP BY org
 *   2. For each org, find their Stripe subscription_item_id
 *   3. POST usage record to Stripe (aggregated quantity)
 *   4. UPDATE usage_records SET reported_to_stripe = true
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// ---------------------------------------------------------------------------
// Stripe API helper
// ---------------------------------------------------------------------------
async function stripeRequest(
  method: string,
  path: string,
  body?: Record<string, string>,
): Promise<unknown> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
  };

  const options: RequestInit = { method, headers };

  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(body).toString();
  }

  const resp = await fetch(url, options);
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`Stripe API error: ${JSON.stringify(data.error)}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  // Simple auth: either internal call or Bearer with service key
  const authHeader = req.headers.get("Authorization") ?? "";
  const isInternal = req.headers.get("x-internal-call") === "true";
  const cronSecret = Deno.env.get("CRON_SECRET");

  // Allow: internal calls, cron secret, or service role key
  if (!isInternal) {
    const bearerToken = authHeader.replace("Bearer ", "");
    if (cronSecret && bearerToken !== cronSecret && bearerToken !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Get all unreported usage records, grouped by organization
    const { data: unreportedRecords, error: fetchError } = await supabase
      .from("usage_records")
      .select("id, organization_id, cost_microcents")
      .eq("reported_to_stripe", false)
      .order("created_at", { ascending: true })
      .limit(10000); // Safety limit

    if (fetchError) throw new Error(`Failed to fetch usage records: ${fetchError.message}`);
    if (!unreportedRecords || unreportedRecords.length === 0) {
      return new Response(JSON.stringify({ message: "No unreported usage", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Aggregate by organization
    const orgAggregates = new Map<string, { count: number; totalCostMicrocents: number; recordIds: string[] }>();

    for (const record of unreportedRecords) {
      const existing = orgAggregates.get(record.organization_id) ?? {
        count: 0,
        totalCostMicrocents: 0,
        recordIds: [],
      };
      existing.count += 1;
      existing.totalCostMicrocents += record.cost_microcents;
      existing.recordIds.push(record.id);
      orgAggregates.set(record.organization_id, existing);
    }

    // 3. Report to Stripe for each org
    const results: Array<{
      organization_id: string;
      calls: number;
      stripe_reported: boolean;
      error?: string;
    }> = [];

    for (const [orgId, aggregate] of orgAggregates) {
      try {
        // Get the org's Stripe subscription item ID
        const { data: billingAccount } = await supabase
          .from("billing_accounts")
          .select("stripe_subscription_item_id, status")
          .eq("organization_id", orgId)
          .single();

        if (!billingAccount?.stripe_subscription_item_id) {
          console.warn(`No subscription item for org ${orgId}, skipping Stripe report`);
          // Still mark as reported to avoid infinite retry
          await supabase
            .from("usage_records")
            .update({ reported_to_stripe: true })
            .in("id", aggregate.recordIds);

          results.push({
            organization_id: orgId,
            calls: aggregate.count,
            stripe_reported: false,
            error: "No subscription item ID",
          });
          continue;
        }

        // Only report to Stripe for paid calls (cost > 0)
        const paidCalls = aggregate.count; // We report all calls; Stripe handles included vs overage

        if (paidCalls > 0) {
          // Report usage to Stripe
          const timestamp = Math.floor(Date.now() / 1000);
          await stripeRequest(
            "POST",
            `/subscription_items/${billingAccount.stripe_subscription_item_id}/usage_records`,
            {
              quantity: String(paidCalls),
              timestamp: String(timestamp),
              action: "increment",
            },
          );
        }

        // 4. Mark records as reported
        // Process in batches of 500 to avoid query size limits
        const batchSize = 500;
        for (let i = 0; i < aggregate.recordIds.length; i += batchSize) {
          const batch = aggregate.recordIds.slice(i, i + batchSize);
          await supabase
            .from("usage_records")
            .update({ reported_to_stripe: true })
            .in("id", batch);
        }

        results.push({
          organization_id: orgId,
          calls: aggregate.count,
          stripe_reported: true,
        });

        console.log(`Reported ${paidCalls} calls to Stripe for org ${orgId}`);
      } catch (orgError) {
        console.error(`Failed to report usage for org ${orgId}:`, orgError);
        results.push({
          organization_id: orgId,
          calls: aggregate.count,
          stripe_reported: false,
          error: orgError instanceof Error ? orgError.message : "Unknown error",
        });
      }
    }

    const totalReported = results.filter((r) => r.stripe_reported).reduce((sum, r) => sum + r.calls, 0);
    const totalFailed = results.filter((r) => !r.stripe_reported).reduce((sum, r) => sum + r.calls, 0);

    return new Response(
      JSON.stringify({
        message: "Usage report complete",
        total_reported: totalReported,
        total_failed: totalFailed,
        orgs_processed: results.length,
        details: results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Usage report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
