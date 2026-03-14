

## Plan : Durcir le déchiffrement dans action-runner

### Problème identifié
Dans `supabase/functions/action-runner/index.ts`, la fonction `decryptValue()` a deux fallbacks dangereux :
1. Si `SECRETS_ENCRYPTION_KEY` n'est pas configurée → retourne la valeur telle quelle (potentiellement chiffrée = inutilisable, ou en clair = pas sécurisé)
2. Si le déchiffrement échoue → retourne la valeur brute en supposant que c'est du plaintext

### Correction prévue

**Fichier : `supabase/functions/action-runner/index.ts`**

Modifier `decryptValue()` pour :
1. **Refuser de fonctionner** si `SECRETS_ENCRYPTION_KEY` n'est pas configurée — lever une erreur au lieu de retourner la valeur brute
2. **Supprimer le fallback plaintext** en cas d'échec de déchiffrement — lever une erreur explicite
3. Ajouter un log d'erreur clair pour faciliter le diagnostic

```typescript
async function decryptValue(encryptedB64: string): Promise<string> {
  const encKeyStr = Deno.env.get("SECRETS_ENCRYPTION_KEY");
  if (!encKeyStr) {
    throw new Error("SECRETS_ENCRYPTION_KEY not configured — cannot decrypt credentials");
  }

  const keyBytes = new TextEncoder().encode(encKeyStr.slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}
```

L'appelant (`serve`) attrapera l'erreur et retournera un message 500 propre sans exposer de secret.

### Ce qui ne change PAS
- `secrets-manager/index.ts` : déjà sécurisé (retourne 503 si clé absente)
- Bypass API key dans action-runner : comportement intentionnel et sécurisé
- Fonctions DB `verify_security_pin` / `hash_security_pin` : non utilisées, aucun risque

