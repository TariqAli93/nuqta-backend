import { describe, expect, test } from "vitest";
import {
  DomainError,
  PermissionDeniedError,
  InsufficientStockError,
  InvalidStateError,
  isDomainError,
} from "../../../src/domain/shared/errors/DomainErrors.ts";

describe("DomainErrors – uncovered subclasses", () => {
  // ── Covers L50-52: PermissionDeniedError ──
  test("PermissionDeniedError sets code, statusCode, and details", () => {
    const err = new PermissionDeniedError("no access", { role: "viewer" });
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect(err.code).toBe("PERMISSION_DENIED");
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("no access");
    expect(err.details).toEqual({ role: "viewer" });
    expect(err.name).toBe("PermissionDeniedError");
    expect(isDomainError(err)).toBe(true);
  });

  // ── Covers L86-92: InsufficientStockError ──
  test("InsufficientStockError sets code, statusCode, and details", () => {
    const err = new InsufficientStockError("not enough", {
      productId: 1,
      available: 5,
      requested: 10,
    });
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.statusCode).toBe(409);
    expect(err.name).toBe("InsufficientStockError");
    expect(err.details).toMatchObject({ productId: 1 });
  });

  // ── Covers L94-100: InvalidStateError ──
  test("InvalidStateError sets code, statusCode, and details", () => {
    const err = new InvalidStateError("already closed", { saleId: 99 });
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(InvalidStateError);
    expect(err.code).toBe("INVALID_STATE");
    expect(err.statusCode).toBe(409);
    expect(err.name).toBe("InvalidStateError");
    expect(err.details).toEqual({ saleId: 99 });
  });
});
