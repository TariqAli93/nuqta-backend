/**
 * JWT Service
 * Handles JWT token signing and verification using jsonwebtoken library.
 * Supports two token types:
 *   - access  (short-lived, default 15 min)  — used for API authorization
 *   - refresh (long-lived, default 7 days)   — used to obtain new access tokens
 *
 * Token structure: { sub, role, permissions, username, fullName, phone?, type, iat, exp, jti }
 */

import jwt, { SignOptions } from "jsonwebtoken";
import { randomBytes } from "crypto";

export type TokenType = "access" | "refresh";

export interface JwtPayload {
  sub: string; // user ID
  role: string; // user role (e.g. "admin", "manager")
  permissions: string[]; // list of permissions
  username: string; // for convenience
  fullName: string; // for convenience
  phone?: string; // optional
  type: TokenType; // discriminator
}

export interface JwtOptions {
  secret: string;
  accessExpiresIn: number; // seconds  (default 900 = 15 min)
  refreshExpiresIn: number; // seconds  (default 604_800 = 7 days)
}

export class JwtService {
  private secret: string;
  private accessExpiresIn: number;
  private refreshExpiresIn: number;

  constructor(
    secret: string,
    accessExpiresIn: number = 900,
    refreshExpiresIn: number = 604_800,
  ) {
    this.secret = secret;
    this.accessExpiresIn = accessExpiresIn;
    this.refreshExpiresIn = refreshExpiresIn;
  }

  // ── helpers ────────────────────────────────────────────────────────

  private signToken(
    payload: Omit<JwtPayload, "iat" | "exp" | "jti">,
    expiresIn: number,
  ): string {
    const jti = randomBytes(16).toString("hex");
    const signOptions: SignOptions = {
      algorithm: "HS256",
      expiresIn,
      jwtid: jti,
    };
    return jwt.sign(payload, this.secret, signOptions);
  }

  private verifyToken(
    token: string,
    expectedType: TokenType,
  ): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.secret) as JwtPayload;
      if (payload.type !== expectedType) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // ── public API ─────────────────────────────────────────────────────

  /**
   * Sign a short-lived access token (default 15 min).
   */
  signAccess(
    payload: Omit<JwtPayload, "iat" | "exp" | "jti" | "type">,
  ): string {
    return this.signToken({ ...payload, type: "access" }, this.accessExpiresIn);
  }

  /**
   * Sign a long-lived refresh token (default 7 days).
   */
  signRefresh(
    payload: Omit<JwtPayload, "iat" | "exp" | "jti" | "type">,
  ): string {
    return this.signToken(
      { ...payload, type: "refresh" },
      this.refreshExpiresIn,
    );
  }

  /**
   * Verify an access token. Returns null if invalid, expired, or wrong type.
   */
  verifyAccess(token: string): JwtPayload | null {
    return this.verifyToken(token, "access");
  }

  /**
   * Verify a refresh token. Returns null if invalid, expired, or wrong type.
   */
  verifyRefresh(token: string): JwtPayload | null {
    return this.verifyToken(token, "refresh");
  }

  // ── backwards-compatible aliases ───────────────────────────────────

  /** @deprecated Use signAccess() instead */
  sign(payload: Omit<JwtPayload, "iat" | "exp" | "jti" | "type">): string {
    return this.signAccess(payload);
  }

  /** @deprecated Use verifyAccess() instead */
  verify(token: string): JwtPayload | null {
    return this.verifyAccess(token);
  }

  /**
   * Decode without verification (for debugging).
   */
  decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token, { complete: false }) as JwtPayload | null;
    } catch {
      return null;
    }
  }
}
