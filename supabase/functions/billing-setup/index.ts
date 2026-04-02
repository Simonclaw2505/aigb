/**
 * Billing Setup Edge Function - AIGB
 * Creates Stripe customer + subscription for an organization.
 *
 * Endpoints:
 *   POST /billing-setup
 *     body: { organization_id, plan_name?, billing_email? }
 *     -> Creates Stripe customer, subscription with metered price
 *     -> Returns checkout URL or client_secret for Stripe Elements
 *
 *   POST /billing-setup  { action: "portal" }
 *     -> Returns Stripe Customer Portal URL for managing payment methods
 *
 *   POST /billing-setup  { action: "status" }
 *     -> Returns current billing status for the org
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID");
const APP_URL = Deno.env.get("APP_URL") || "https://aigb.lovable.app";

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
  // CORS
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  const corsHeaders = cors.headers;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const body = await req.json();
    const { organization_id, action, plan_name, billing_email } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is owner/admin of the org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only owners and admins can manage billing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: status ─────────────────────────────────────────────────────
    if (action === "status") {
      const { data: billingStatus } = await supabase
        .rpc("get_billing_status", { p_organization_id: organization_id });

      return new Response(JSON.stringify({ billing: billingStatus?.[0] ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: portal (Stripe Customer Portal) ──────────────────────────
    if (action === "portal") {
      const { data: account } = await supabase
        .from("billing_accounts")
        .select("stripe_customer_id")
        .eq("organization_id", organization_id)
        .single();

      if (!account?.stripe_customer_id) {
        return new Response(JSON.stringify({ error: "No billing account found — set up billing first" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await stripeRequest("POST", "/billing_portal/sessions", {
        customer: account.stripe_customer_id,
        return_url: `${APP_URL}/billing`,
      }) as { url: string };

      return new Response(JSON.stringify({ portal_url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: setup (create or update billing) ─────────────────────────

    // Get or determine plan
    const targetPlan = plan_name || "starter";
    const { data: plan } = await supabase
      .from("billing_plans")
      .select("*")
      .eq("name", targetPlan)
      .eq("is_active", true)
      .single();

    if (!plan) {
      return new Response(JSON.stringify({ error: `Plan '${targetPlan}' not found` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organization_id)
      .single();

    // Check for existing billing account
    let { data: existingAccount } = await supabase
      .from("billing_accounts")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    let stripeCustomerId = existingAccount?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!stripeCustomerId) {
      const customer = await stripeRequest("POST", "/customers", {
        email: billing_email || authData.user.email || "",
        name: org?.name || `Org ${organization_id}`,
        "metadata[organization_id]": organization_id,
        "metadata[created_by]": userId,
      }) as { id: string };

      stripeCustomerId = customer.id;
    }

    // Use Stripe Checkout for subscription setup (includes payment method collection)
    const priceId = plan.stripe_price_id || STRIPE_PRICE_ID;
    if (!priceId) {
      return new Response(JSON.stringify({ error: "No Stripe price configured for this plan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutSession = await stripeRequest("POST", "/checkout/sessions", {
      customer: stripeCustomerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      success_url: `${APP_URL}/billing?setup=success`,
      cancel_url: `${APP_URL}/billing?setup=cancelled`,
      "subscription_data[metadata][organization_id]": organization_id,
      "metadata[organization_id]": organization_id,
    }) as { id: string; url: string };

    // Upsert billing account
    if (existingAccount) {
      await supabase
        .from("billing_accounts")
        .update({
          stripe_customer_id: stripeCustomerId,
          plan_id: plan.id,
          billing_email: billing_email || existingAccount.billing_email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAccount.id);
    } else {
      await supabase
        .from("billing_accounts")
        .insert({
          organization_id,
          stripe_customer_id: stripeCustomerId,
          plan_id: plan.id,
          status: "inactive", // Will be activated by webhook
          billing_email: billing_email || authData.user.email,
        });
    }

    return new Response(
      JSON.stringify({
        checkout_url: checkoutSession.url,
        checkout_session_id: checkoutSession.id,
        customer_id: stripeCustomerId,
        plan: plan.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Billing setup error:", error);
    const { headers: errorHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...errorHeaders, "Content-Type": "application/json" } },
    );
  }
});
