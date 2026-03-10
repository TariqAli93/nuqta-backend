import { describe, expect, test } from "vitest";
import {
  ConflictError,
  NotFoundError,
} from "../../../packages/core/src/shared/errors/DomainErrors.ts";
import {
  fail,
  failWith,
  isErr,
  isOk,
  mapErrorToResult,
  ok,
  toApiError,
} from "../../../packages/core/src/shared/contracts/contract.ts";

describe("contract helpers", () => {
  test("wraps successful results", () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
  });

  test("maps domain errors to API errors", () => {
    expect(toApiError(new NotFoundError("missing"))).toEqual({
      code: "NOT_FOUND",
      message: "missing",
      status: 404,
      details: undefined,
    });
  });

  test("maps unknown errors to internal failures", () => {
    expect(mapErrorToResult(new Error("boom"))).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "boom",
      },
    });
    expect(failWith("CONFLICT", "exists", 409)).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "exists",
        status: 409,
        details: undefined,
      },
    });
    expect(toApiError(new ConflictError("conflict"))).toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  // ── Covers L73-77: toApiError with a plain string ──
  test("maps a plain string error to ApiError", () => {
    const result = toApiError("something broke");
    expect(result).toEqual({
      code: "INTERNAL_ERROR",
      message: "something broke",
    });
  });

  // ── Covers L69: toApiError with an Error whose .message is empty ──
  test("maps an Error with empty message to the fallback string", () => {
    const result = toApiError(new Error(""));
    expect(result).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  });

  // ── Covers L79: toApiError with a completely unknown type ──
  test("maps a non-Error non-string value to generic ApiError", () => {
    const result = toApiError(42);
    expect(result).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  });

  // ── Covers L91-95: isOk / isErr type guards ──
  test("isOk returns true for ok results and false for failures", () => {
    expect(isOk(ok("data"))).toBe(true);
    expect(isOk(fail({ code: "ERR", message: "no" }))).toBe(false);
  });

  test("isErr returns true for failure results and false for ok", () => {
    expect(isErr(fail({ code: "ERR", message: "no" }))).toBe(true);
    expect(isErr(ok("data"))).toBe(false);
  });
});
