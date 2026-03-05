

## Diagnostic

The problem is straightforward: **all state in the Import page is ephemeral React `useState`**. When you navigate away and come back, the component unmounts and remounts — all form fields reset to empty.

This affects:
1. **`useApiImport` hook** — `parsedSpec`, `selectedEndpoints`, `rawContent` all reset to `null`/empty
2. **`Import.tsx`** — `specUrl`, `specJson`, `importMode`, `activeTab` all reset
3. **`ManualApiConfig`** — `name`, `baseUrl`, `authType`, `endpoints[]` all reset

## Root Cause

React Router remounts components on navigation. There is no persistence (sessionStorage, React context, or global state) to survive navigation.

## Solution: Persist form state in `sessionStorage`

The lightest fix that doesn't add features or change UX — just prevent data loss:

### 1. Create a `useSessionState` utility hook
A drop-in replacement for `useState` that syncs to `sessionStorage`. Data survives navigation but clears when the browser tab closes (appropriate for draft form data).

```ts
// src/hooks/useSessionState.ts
function useSessionState<T>(key: string, initialValue: T): [T, SetState<T>]
```
- Serializes to JSON on every update
- Reads from sessionStorage on mount
- Provides a `clear` helper

### 2. Apply to `Import.tsx`
Replace `useState` with `useSessionState` for:
- `importMode` → `sessionStorage` key `"import_mode"`
- `specUrl` → `"import_spec_url"`
- `specJson` → `"import_spec_json"`
- `activeTab` → `"import_active_tab"`

### 3. Apply to `useApiImport.ts`
Persist the `ImportState` object (minus the `status` field which should always reset to `"idle"`):
- `parsedSpec` → `"import_parsed_spec"`
- `selectedEndpoints` (serialize `Set` as array) → `"import_selected_endpoints"`
- `rawContent` → `"import_raw_content"`
- `sourceUrl` → `"import_source_url"`

### 4. Apply to `ManualApiConfig.tsx`
Persist manual form fields:
- `apiName`, `baseUrl`, `description`, `authType`, `authHeaderName`, `extraHeaders`, `endpoints[]`
- Key prefix: `"manual_api_"`
- Clear all keys on successful save (already calls `onSuccess`)

### What stays the same
- No new UI elements, buttons, or features
- `reset()` function will also clear sessionStorage keys
- Successful save clears the persisted draft
- Data from `?library=` query param still takes priority over persisted data

