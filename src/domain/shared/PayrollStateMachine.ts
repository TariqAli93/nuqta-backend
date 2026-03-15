/**
 * Payroll State Machine
 *
 * Defines valid payroll lifecycle transitions and enforces them so that
 * invalid operations are caught at the domain layer before any DB writes.
 *
 * States:
 *   draft → submitted → approved → disbursed
 *                ↕
 *             cancelled
 *
 * Detailed transition table:
 *   draft       → submitted    (payroll processor submits for review)
 *   draft       → cancelled    (payroll processor discards draft)
 *   submitted   → approved     (manager / admin approves)
 *   submitted   → draft        (payroll processor requests revision)
 *   submitted   → cancelled    (manager / admin cancels before approval)
 *   approved    → disbursed    (system records payment completion)
 *   approved    → submitted    (admin reverts to re-review)
 */

import { InvalidStateError } from "./errors/DomainErrors.js";

export type PayrollStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "disbursed"
  | "cancelled";

// Allowed transitions: { from → Set<to> }
const TRANSITIONS: Record<PayrollStatus, Set<PayrollStatus>> = {
  draft: new Set<PayrollStatus>(["submitted", "cancelled"]),
  submitted: new Set<PayrollStatus>(["approved", "draft", "cancelled"]),
  approved: new Set<PayrollStatus>(["disbursed", "submitted"]),
  disbursed: new Set<PayrollStatus>(),   // terminal state
  cancelled: new Set<PayrollStatus>(),   // terminal state
};

export class PayrollStateMachine {
  /**
   * Assert that a transition is valid.
   * Throws InvalidStateError if not.
   */
  static transition(
    current: PayrollStatus,
    next: PayrollStatus,
    payrollRunId: number,
  ): void {
    const allowed = TRANSITIONS[current];
    if (!allowed || !allowed.has(next)) {
      throw new InvalidStateError(
        `Payroll run #${payrollRunId}: cannot transition from "${current}" to "${next}". ` +
          `Allowed transitions from "${current}": ${
            allowed && allowed.size > 0
              ? Array.from(allowed).join(", ")
              : "none (terminal state)"
          }.`,
        { payrollRunId, current, next },
      );
    }
  }

  /** Returns true if the given status is a terminal state. */
  static isTerminal(status: PayrollStatus): boolean {
    return status === "disbursed" || status === "cancelled";
  }

  /** Returns all statuses a payroll run can transition to from the given status. */
  static allowedTransitions(from: PayrollStatus): PayrollStatus[] {
    return Array.from(TRANSITIONS[from] ?? []);
  }
}
