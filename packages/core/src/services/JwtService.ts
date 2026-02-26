/**
 * JWT Service
 * Handles JWT token signing and verification for both Cloud and Offline modes
 * Token structure: { sub: userId, role: userRole, permissions: permissionList, iat, exp, jti }
 */

import crypto from 'crypto';

export interface JwtPayload {
  sub: number; // User ID
  role: string;
  permissions: string[];
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID (for refresh token rotation)
}

export interface JwtOptions {
  secret: string;
  expiresIn: number; // seconds
}

export class JwtService {
  private secret: string;
  private expiresIn: number;

  constructor(secret: string, expiresIn: number = 900) {
    // Default 15 min access token
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  /**
   * Sign a JWT token (simple implementation, suitable for HS256)
   */
  sign(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomBytes(16).toString('hex');

    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.expiresIn,
      jti,
    };

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const token =
      this.base64UrlEncode(JSON.stringify(header)) +
      '.' +
      this.base64UrlEncode(JSON.stringify(fullPayload));

    const signature = this.hmacSha256(token, this.secret);
    return token + '.' + signature;
  }

  /**
   * Verify and decode a JWT token
   */
  verify(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;
      const expectedSignature = this.hmacSha256(`${headerB64}.${payloadB64}`, this.secret);

      if (signatureB64 !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(payloadB64)) as JwtPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Decode without verification (for debugging)
   */
  decode(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(this.base64UrlDecode(parts[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  // Helper: Base64URL encode
  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Helper: Base64URL decode
  private base64UrlDecode(str: string): string {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  // Helper: HMAC-SHA256
  private hmacSha256(message: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
