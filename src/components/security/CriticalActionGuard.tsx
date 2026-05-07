/**
 * CriticalActionGuard
 * Wraps a trigger element and intercepts its action to require explicit
 * user confirmation (and optionally an operator-key proof) before executing.
 *
 * Use for any sensitive change: granting/revoking permissions, rotating keys,
 * deleting agents, escalating roles, etc.
 */

import { useState, cloneElement, isValidElement, ReactElement } from "react";
import { ConfirmActionDialog } from "@/components/simulator/ConfirmActionDialog";

interface OperatorInfo {
  operator_id: string;
  operator_name: string;
  role: string;
}

interface CriticalActionGuardProps {
  /** The element that triggers the guarded action (Button, Checkbox, etc.). Its onClick is intercepted. */
  trigger: ReactElement;
  actionName: string;
  description: string;
  estimatedImpact: string;
  /** If true, requires an operator key to confirm identity */
  requiresOperatorKey?: boolean;
  /** Required when requiresOperatorKey=true */
  agentId?: string;
  /** Called only after the user confirms */
  onConfirm: (operatorInfo?: OperatorInfo) => void | Promise<void>;
  /** Skip the dialog entirely (for low-risk passthrough) */
  bypass?: boolean;
}

export function CriticalActionGuard({
  trigger,
  actionName,
  description,
  estimatedImpact,
  requiresOperatorKey = false,
  agentId,
  onConfirm,
  bypass = false,
}: CriticalActionGuardProps) {
  const [open, setOpen] = useState(false);

  if (!isValidElement(trigger)) return null;

  const triggerProps = trigger.props as { onClick?: (e: React.MouseEvent) => void; onCheckedChange?: (v: boolean) => void };

  const interceptedTrigger = cloneElement(trigger, {
    onClick: (e: React.MouseEvent) => {
      if (bypass) {
        triggerProps.onClick?.(e);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    },
    onCheckedChange: bypass
      ? triggerProps.onCheckedChange
      : () => setOpen(true),
  } as Record<string, unknown>);

  return (
    <>
      {interceptedTrigger}
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={(operatorInfo) => onConfirm(operatorInfo)}
        onCancel={() => setOpen(false)}
        stepNumber={1}
        actionName={actionName}
        description={description}
        estimatedImpact={estimatedImpact}
        requiresOperatorKey={requiresOperatorKey}
        agentId={agentId}
      />
    </>
  );
}
