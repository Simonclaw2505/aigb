

## Diagnostic

The error `Failed to decode base64` occurs in `decryptValue` (action-runner line 257) because several secrets in the database were stored as **plaintext API keys** rather than AES-GCM encrypted values. When `atob()` tries to decode a raw token like `ntn_46691...`, it fails because it's not valid base64.

This happened because secrets were likely inserted directly into the `secrets` table (or via an older code path) without going through the `secrets-manager` encrypt function.

## Fix — action-runner/index.ts

Make `decryptValue` resilient: if base64 decoding or AES-GCM decryption fails, assume the value is a plaintext credential and return it as-is. This handles both legacy plaintext secrets and properly encrypted ones.

**Lines 249-262** — wrap the decrypt logic in a try/catch:

```ts
async function decryptValue(encryptedB64: string): Promise<string> {
  const encKeyStr = Deno.env.get("SECRETS_ENCRYPTION_KEY");
  if (!encKeyStr) {
    // No encryption key configured — treat value as plaintext
    console.warn("SECRETS_ENCRYPTION_KEY not set, using value as-is");
    return encryptedB64;
  }
  
  try {
    const keyBytes = new TextEncoder().encode(encKeyStr.slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
    );
    const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, cryptoKey, ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    // Value is likely stored as plaintext (legacy) — use as-is
    console.warn("Failed to decrypt secret, using as plaintext:", err instanceof Error ? err.message : err);
    return encryptedB64;
  }
}
```

**Single file change**: `supabase/functions/action-runner/index.ts`, replace `decryptValue` function (~15 lines modified).

This is a backward-compatible fix — properly encrypted secrets still decrypt normally, while legacy plaintext secrets stop crashing the execution.

