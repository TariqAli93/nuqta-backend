import type { Response as InjectResponse } from "light-my-request";
import { expect } from "vitest";

export function parseJson<T>(response: InjectResponse): T {
  return JSON.parse(response.body) as T;
}

export function expectOk<T>(response: InjectResponse, statusCode = 200): T {
  expect(response.statusCode).toBe(statusCode);
  const payload = parseJson<{ ok: true; data: T }>(response);
  expect(payload.ok).toBe(true);
  return payload.data;
}

export function expectError(
  response: InjectResponse,
  statusCode: number,
  code: string,
) {
  expect(response.statusCode).toBe(statusCode);
  const payload = parseJson<{
    ok: false;
    error: { code: string; message: string; details?: unknown };
  }>(response);
  expect(payload.ok).toBe(false);
  expect(payload.error.code).toBe(code);
  expect(typeof payload.error.message).toBe("string");
  return payload.error;
}
