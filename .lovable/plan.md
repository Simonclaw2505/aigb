

## Diagnostic

The `body_template` for your SendGrid action contains `{{html_content}}` as a placeholder. But the LLM (generate-plan) produces input field names based on the action's `input_schema` — likely something like `message`, `body`, or `text`. Since there's no field literally called `html_content` in the inputs, the placeholder stays unresolved and gets sent as-is to SendGrid.

The existing extraction logic (lines 666-676 of action-runner) already handles some mappings (`content[0].value` → `html_content`, `html` → `html_content`), but misses common synonyms the LLM might use.

## Root Cause

The `applyBodyTemplate` function preserves unresolved placeholders verbatim (line 232): if `inputs["html_content"]` is undefined, `{{html_content}}` stays in the output.

## Fix — action-runner/index.ts

Expand the field normalization block (around lines 666-676) to also map common content field names to `html_content` before template resolution:

```
// After existing html → html_content mapping, add:
const contentAliases = ["message", "body", "text", "email_body", "email_content"];
if (!templateInputs.html_content) {
  for (const alias of contentAliases) {
    if (templateInputs[alias] && typeof templateInputs[alias] === "string") {
      templateInputs.html_content = templateInputs[alias];
      break;
    }
  }
}
```

This ensures that regardless of what field name the LLM chooses for the email content, it gets mapped to `html_content` before the `body_template` placeholders are resolved.

**Single file change**: `supabase/functions/action-runner/index.ts` (~5 lines added after line 676).

