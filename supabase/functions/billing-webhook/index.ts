/**
 * Billing Webhook Edge Function - AIGB
 * Receives Stripe webhook events and updates billing state.
 *
 * Events handled:
 *   - customer.subscription.created / updated / deleted
 *   - invoice.paid / invoice.payment_failed
 *   - payment_method.attached
 *   - checkout.session.completed
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// ---------------------------------------------------------------------------
// Stripe signature verification (HMAC-SHA256)
// ---------------------------------------------------------------------------
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.timestamp)) > tolerance) return false;

  // Compute expected signature
  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.signatures.includes(expectedSig);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // Verify webhook signature
  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error("Invalid Stripe webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
  }

  const event = JSON.parse(body);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log(`Stripe event: ${event.type} [${event.id}]`);

  try {
    switch (event.type) {
      // ── Subscription lifecycle ──────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const status = sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status === "past_due"
          ? "past_due"
          : sub.status === "canceled" || sub.status === "unpaid"
          ? "suspended"
          : "inactive";

        const subscriptionItemId = sub.items?.data?.[0]?.id ?? null;

        await supabase
          .from("billing_accounts")
          .update({
            stripe_subscription_id: sub.id,
            stripe_subscription_item_id: subscriptionItemId,
            status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", sub.customer);

        console.log(`Updated billing account for customer ${sub.customer} -> ${status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase
          .from("billing_accounts")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", sub.customer);

        console.log(`Cancelled billing for customer ${sub.customer}`);
        break;
      }

      // ── Invoice events ─────────────────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object;

        // Find the org
        const { data: account } = await supabase
          .from("billing_accounts")
          .select("organization_id")
          .eq("stripe_customer_id", invoice.customer)
          .single();

        if (account) {
          await supabase.from("billing_invoices").upsert({
            stripe_invoice_id: invoice.id,
            organization_id: account.organization_id,
            amount_cents: invoice.amount_paid,
            total_calls: invoice.lines?.data?.[0]?.quantity ?? 0,
            period_start: new Date(invoice.period_start * 1000).toISOString(),
            period_end: new Date(invoice.period_end * 1000).toISOString(),
            status: "paid",
            pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
          }, { onConflict: "stripe_invoice_id" });

          // Reset period counters
          await supabase
            .from("billing_accounts")
            .update({
              total_calls_this_period: 0,
              total_cost_microcents_this_period: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", invoice.customer);

          console.log(`Invoice ${invoice.id} paid for org ${account.organization_id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await supabase
          .from("billing_accounts")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", invoice.customer);

        // Also log the failed invoice
        const { data: account } = await supabase
          .from("billing_accounts")
          .select("organization_id")
          .eq("stripe_customer_id", invoice.customer)
          .single();

        if (account) {
          await supabase.from("billing_invoices").upsert({
            stripe_invoice_id: invoice.id,
            organization_id: account.organization_id,
            amount_cents: invoice.amount_due,
            total_calls: 0,
            period_start: new Date(invoice.period_start * 1000).toISOString(),
            period_end: new Date(invoice.period_end * 1000).toISOString(),
            status: "uncollectible",
            pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
          }, { onConflict: "stripe_invoice_id" });
        }

        console.log(`Payment failed for customer ${invoice.customer}`);
        break;
      }

      // ── Payment method ─────────────────────────────────────────────────
      case "payment_method.attached": {
        const pm = event.data.object;
        await supabase
          .from("billing_accounts")
          .update({
            stripe_payment_method_id: pm.id,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", pm.customer);

        console.log(`Payment method ${pm.id} attached for customer ${pm.customer}`);
        break;
      }

      // ── Checkout session completed ─────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          await supabase
            .from("billing_accounts")
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              status: "active",
              billing_email: session.customer_email,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", session.customer);
        }
        console.log(`Checkout completed for customer ${session.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
