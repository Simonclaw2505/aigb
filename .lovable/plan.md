

## Diagnostic

The error "Failed to send a request to the Edge Function" comes from a **CORS rejection**. Your published URL `https://aigb.lovable.app` is blocked by the strict CORS allowlist in `supabase/functions/_shared/cors.ts`.

The current regex only allows Lovable preview URLs with the pattern `xxx--yyy.lovable.app` (line 79), but your published URL `aigb.lovable.app` has no `--` separator, so it gets rejected with a 403.

## Fix

Update `supabase/functions/_shared/cors.ts` to also match simple subdomain patterns on `lovable.app` (published app URLs):

**Line 79**: Add a second regex pattern to allow `https://*.lovable.app` (single subdomain, no `--`):

```ts
// Existing: preview URLs
if (origin.match(/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/)) {
  return true;
}

// NEW: published app URLs (e.g. https://aigb.lovable.app)
if (origin.match(/^https:\/\/[a-z0-9-]+\.lovable\.app$/)) {
  return true;
}
```

**Single file change**: `supabase/functions/_shared/cors.ts` (~3 lines added after line 81).

