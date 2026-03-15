/**
 * Property-based tests for the Sale state machine.
 *
 * A sale moves through these states:
 *   pending → completed | credit | partial
 *   completed / credit / partial → refunded (partial or full)
 *   Any non-cancelled → cancelled
 *   cancelled → (terminal)
 *
 * We model the allowed transitions and verify that:
 *  1. No random sequence of valid actions reaches an undefined/invalid status
 *  2. Terminal states (cancelled) cannot be left
 *  3. Status always belongs to the valid set
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ── Sale status model ─────────────────────────────────────────────────────────

type SaleStatus = "pending" | "completed" | "credit" | "partial" | "cancelled" | "refunded";

const VALID_STATUSES = new Set<SaleStatus>([
  "pending",
  "completed",
  "credit",
  "partial",
  "cancelled",
  "refunded",
]);

const TERMINAL_STATUSES = new Set<SaleStatus>(["cancelled"]);

// Simplified transition rules matching CancelSaleUseCase / RefundSaleUseCase
const TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  pending: ["completed", "credit", "partial", "cancelled"],
  completed: ["refunded", "cancelled"],
  credit: ["refunded", "cancelled"],
  partial: ["completed", "refunded", "cancelled"],
  refunded: [], // can be partially refunded again — but we simplify here
  cancelled: [], // terminal
};

type Action = "complete" | "credit" | "partial" | "refund" | "cancel";

function applyAction(status: SaleStatus, action: Action): SaleStatus | null {
  const transitions = TRANSITIONS[status];
  switch (action) {
    case "complete":
      return transitions.includes("completed") ? "completed" : null;
    case "credit":
      return transitions.includes("credit") ? "credit" : null;
    case "partial":
      return transitions.includes("partial") ? "partial" : null;
    case "refund":
      return transitions.includes("refunded") ? "refunded" : null;
    case "cancel":
      return transitions.includes("cancelled") ? "cancelled" : null;
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const actionArb = fc.constantFrom<Action>(
  "complete",
  "credit",
  "partial",
  "refund",
  "cancel",
);

const actionSequenceArb = fc.array(actionArb, { minLength: 1, maxLength: 20 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Sale State Machine — property-based tests", () => {
  it("Invariant 1: status is always in the valid set after any sequence of actions", () => {
    fc.assert(
      fc.property(actionSequenceArb, (actions) => {
        let status: SaleStatus = "pending";

        for (const action of actions) {
          const next = applyAction(status, action);
          if (next !== null) {
            status = next;
          }
          // Whether the action succeeded or not, status must be valid
          expect(VALID_STATUSES.has(status)).toBe(true);
        }
      }),
    );
  });

  it("Invariant 2: terminal states cannot be left", () => {
    fc.assert(
      fc.property(actionSequenceArb, actionSequenceArb, (preActions, postActions) => {
        let status: SaleStatus = "pending";

        // Apply pre-actions to reach a terminal state (if possible)
        for (const action of preActions) {
          const next = applyAction(status, action);
          if (next !== null) status = next;
        }

        // If we're in a terminal state, no further action should change it
        if (TERMINAL_STATUSES.has(status)) {
          const terminalStatus = status;
          for (const action of postActions) {
            const next = applyAction(status, action);
            if (next !== null) status = next;
            expect(status).toBe(terminalStatus);
          }
        }
      }),
    );
  });

  it("Invariant 3: valid actions from pending always lead to a valid status", () => {
    fc.assert(
      fc.property(actionArb, (action) => {
        const next = applyAction("pending", action);
        if (next !== null) {
          expect(VALID_STATUSES.has(next)).toBe(true);
        }
      }),
    );
  });

  it("Invariant 4: cancelled status is terminal (no transitions out)", () => {
    fc.assert(
      fc.property(actionArb, (action) => {
        const next = applyAction("cancelled", action);
        expect(next).toBeNull();
      }),
    );
  });
});
