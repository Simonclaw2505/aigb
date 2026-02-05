

# Prompt 8 - Complete Implementation Plan

## Current Status
The previous attempts **failed to create the UI components**. Here's what exists vs what's missing:

| Component | Status |
|-----------|--------|
| Database migration (rollback fields) | ✅ Done |
| `rollback-execution` Edge Function | ✅ Done |
| `src/components/audit/DiffViewer.tsx` | ❌ Missing |
| `src/components/audit/RollbackDialog.tsx` | ❌ Missing |
| `src/components/audit/ExecutionTimeline.tsx` | ❌ Missing |
| `src/hooks/useAuditLogs.ts` | ❌ Missing |
| `AuditLogs.tsx` data integration | ❌ Still empty |

---

## Implementation Steps

### 1. Create useAuditLogs Hook
**File:** `src/hooks/useAuditLogs.ts`

Fetch and combine data from:
- `audit_logs` table (general activity)
- `execution_runs` table with `action_templates` join (detailed execution history)

Features:
- Filtering by project, resource type, date range
- Real-time updates option
- Pagination support

### 2. Create DiffViewer Component
**File:** `src/components/audit/DiffViewer.tsx`

Display before/after snapshots for write actions:
- Compare two JSON objects
- Highlight added (green), removed (red), changed (yellow) keys
- Collapsible nested objects
- Handle null/missing values gracefully

### 3. Create ExecutionTimeline Component
**File:** `src/components/audit/ExecutionTimeline.tsx`

Visual timeline showing:
- Action name and status (success/failed/running/rolled_back)
- Risk level badge
- Who triggered it (user vs bot/agent)
- Timestamps with relative time
- Expandable details (inputs, outputs, diff)
- Rollback button for reversible actions

### 4. Create RollbackDialog Component
**File:** `src/components/audit/RollbackDialog.tsx`

Confirmation dialog with:
- Original action details
- Warning about reversal
- Optional reason input
- Calls `rollback-execution` Edge Function

### 5. Update AuditLogs Page
**File:** `src/pages/AuditLogs.tsx`

Integrate all components:
- Tabbed interface: "Audit Trail" | "Execution Timeline"
- Connect to `useAuditLogs` hook
- Add date range picker
- Working search and filters
- Export functionality

---

## Technical Details

### Data Flow
```text
AuditLogs.tsx
    ├── useAuditLogs() → fetches audit_logs + execution_runs
    ├── ExecutionTimeline
    │       ├── DiffViewer (for write actions with diff_summary)
    │       └── RollbackDialog (for reversible actions)
    └── Filters/Search
```

### Key Types
```typescript
interface ExecutionRun {
  id: string;
  action_template: {
    name: string;
    is_reversible: boolean;
    rollback_config: RollbackConfig | null;
    risk_level: string;
  };
  status: 'pending' | 'running' | 'success' | 'failed';
  input_parameters: Record<string, unknown>;
  output_data: Record<string, unknown>;
  diff_summary: { before: object; after: object } | null;
  rolled_back_at: string | null;
  is_rollback: boolean;
  original_execution_id: string | null;
}
```

### RollbackDialog API Call
```typescript
const response = await supabase.functions.invoke('rollback-execution', {
  body: { execution_id, reason }
});
```

---

## Files to Create/Modify
1. **Create** `src/hooks/useAuditLogs.ts`
2. **Create** `src/components/audit/DiffViewer.tsx`
3. **Create** `src/components/audit/ExecutionTimeline.tsx`
4. **Create** `src/components/audit/RollbackDialog.tsx`
5. **Update** `src/pages/AuditLogs.tsx`

