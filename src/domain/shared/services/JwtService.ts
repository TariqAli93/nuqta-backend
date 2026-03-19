/**
 * JWT Service
 * Handles JWT token signing and verification.
 *
 * Supports two signing algorithms:
 *   - HS256 (HMAC-SHA256)  — symmetric, uses JWT_SECRET
 *   - RS256 (RSA-SHA256)   — asymmetric, uses JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
 *
 * Falls back to HS256 when RS256 is configured but keys are absent.
 *
 * Token structure:
 *   { sub, role, permissions, username, fullName, phone?, type, iat, exp, jti }
 *
 * The `jti` claim (UUID) uniquely identifies each issued token and is used
 * by the revocation system to implement instant logout.
 */

import jwt, { Algorithm, SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../../../shared/env.js";

export type TokenType = "access" | "refresh";

export interface JwtPayload {
  sub: string; // user ID
  role: string; // user role
  permissions: string[];
  username: string;
  fullName: string;
  phone?: string;
  type: TokenType;
  jti?: string; // JWT ID for revocation
  iat?: number; // issued at (added by jwt.sign)
  exp?: number; // expiration (added by jwt.sign)
}

export interface JwtOptions {
  secret: string;
  accessExpiresIn: number; // seconds (default 900 = 15 min)
  refreshExpiresIn: number; // seconds (default 604_800 = 7 days)
}

export class JwtService {
  private readonly algorithm: Algorithm;
  private readonly signingKey: string; // private key or HMAC secret
  private readonly verifyKey: string; // public key or HMAC secret
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor(
    secret: string,
    accessExpiresIn: number = 900,
    refreshExpiresIn: number = 604_800,
  ) {
    this.accessExpiresIn = accessExpiresIn;
    this.refreshExpiresIn = refreshExpiresIn;

    // Determine algorithm: use RS256 only when both keys are present.
    const useRsa =
      env.JWT_ALGORITHM === "RS256" &&
      !!env.JWT_PRIVATE_KEY &&
      !!env.JWT_PUBLIC_KEY;

    if (useRsa) {
      this.algorithm = "RS256";
      this.signingKey = env.JWT_PRIVATE_KEY!;
      this.verifyKey = env.JWT_PUBLIC_KEY!;
    } else {
      this.algorithm = "HS256";
      this.signingKey = secret;
      this.verifyKey = secret;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private signToken(
    payload: Omit<JwtPayload, "iat" | "exp" | "jti">,
    expiresIn: number,
  ): string {
    const jti = randomUUID();
    const signOptions: SignOptions = {
      algorithm: this.algorithm,
      expiresIn,
      jwtid: jti, // sets the standard "jti" JWT claim
    };
    return jwt.sign(payload, this.signingKey, signOptions);
  }

  private verifyToken(
    token: string,
    expectedType: TokenType,
  ): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.verifyKey, {
        algorithms: [this.algorithm],
      }) as JwtPayload;
      if (payload.type !== expectedType) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Sign a short-lived access token (default 15 min).
   * The returned token's `jti` claim can be used to revoke it.
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

  /** Verify an access token.  Returns null if invalid, expired, or wrong type. */
  verifyAccess(token: string): JwtPayload | null {
    return this.verifyToken(token, "access");
  }

  /** Verify a refresh token.  Returns null if invalid, expired, or wrong type. */
  verifyRefresh(token: string): JwtPayload | null {
    return this.verifyToken(token, "refresh");
  }

  // ── Backwards-compatible aliases ───────────────────────────────────────

  /** @deprecated Use signAccess() */
  sign(payload: Omit<JwtPayload, "iat" | "exp" | "jti" | "type">): string {
    return this.signAccess(payload);
  }

  /** @deprecated Use verifyAccess() */
  verify(token: string): JwtPayload | null {
    return this.verifyAccess(token);
  }

  /** Decode without verification (debugging only). */
  decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token, { complete: false }) as JwtPayload | null;
    } catch {
      return null;
    }
  }
}
