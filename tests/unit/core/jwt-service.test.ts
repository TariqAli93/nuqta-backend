import { afterEach, describe, expect, test, vi } from "vitest";
import { JwtService } from "../../../packages/core/src/services/JwtService.ts";

describe("JwtService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("signs and verifies tokens with issued claims", () => {
    vi.useFakeTimers();
    const issuedAt = new Date("2026-03-01T10:00:00.000Z");
    vi.setSystemTime(issuedAt);

    const jwt = new JwtService("unit-secret", 3600);
    const token = jwt.sign({
      sub: 1,
      role: "admin",
      permissions: ["users:read"],
    });
    const payload = jwt.verify(token);

    expect(payload).toMatchObject({
      sub: 1,
      role: "admin",
      permissions: ["users:read"],
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(issuedAt.getTime() / 1000) + 3600,
    });
    expect(typeof payload?.jti).toBe("string");
  });

  test("rejects tampered tokens", () => {
    const jwt = new JwtService("unit-secret", 3600);
    const token = jwt.sign({
      sub: 1,
      role: "admin",
      permissions: ["users:read"],
    });

    const tampered = `${token.slice(0, -1)}x`;
    expect(jwt.verify(tampered)).toBeNull();
  });

  test("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));

    const jwt = new JwtService("unit-secret", 1);
    const token = jwt.sign({
      sub: 1,
      role: "admin",
      permissions: ["users:read"],
    });

    vi.setSystemTime(new Date("2026-03-01T10:00:03.000Z"));
    expect(jwt.verify(token)).toBeNull();
  });

  // ── Covers L86-92: decode() happy path ──
  test("decode() returns payload without verifying signature", () => {
    const jwt = new JwtService("unit-secret", 3600);
    const token = jwt.sign({
      sub: 5,
      role: "cashier",
      permissions: ["sales:create"],
    });

    // Tamper with the signature so verify() would fail
    const tampered = token.replace(/\.[^.]+$/, ".invalidsig");
    expect(jwt.verify(tampered)).toBeNull();

    // decode() still returns the payload
    const decoded = jwt.decode(tampered);
    expect(decoded).toMatchObject({
      sub: 5,
      role: "cashier",
      permissions: ["sales:create"],
    });
  });

  // ── Covers L89: decode() returns null for malformed (non-3-part) token ──
  test("decode() returns null for tokens without 3 parts", () => {
    const jwt = new JwtService("unit-secret", 3600);
    expect(jwt.decode("only-one-part")).toBeNull();
    expect(jwt.decode("two.parts")).toBeNull();
  });

  // ── Covers L90 catch branch: decode() with corrupt base64 payload ──
  test("decode() returns null when payload is not valid JSON", () => {
    const jwt = new JwtService("unit-secret", 3600);
    expect(jwt.decode("header.!!!invalid-base64!!!.sig")).toBeNull();
  });

  // ── Covers L86: verify() catch branch — internal throw returns null ──
  test("verify() returns null when an internal method throws", () => {
    const jwt = new JwtService("unit-secret", 3600);
    // Override the private hmacSha256 to force a throw inside the try block
    (jwt as any).hmacSha256 = () => {
      throw new TypeError("forced crash");
    };
    expect(jwt.verify("a.b.c")).toBeNull();
  });

  // ── Covers L67: verify() returns null for malformed (non-3-part) token ──
  test("verify() returns null for tokens without 3 parts", () => {
    const jwt = new JwtService("unit-secret", 3600);
    expect(jwt.verify("no-dots")).toBeNull();
    expect(jwt.verify("just.two")).toBeNull();
  });
});
