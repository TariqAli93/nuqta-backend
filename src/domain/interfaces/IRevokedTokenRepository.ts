/**
 * Repository interface for tracking revoked JWT tokens.
 * Used to implement instant logout / token invalidation.
 */
export interface IRevokedTokenRepository {
  /**
   * Record a token as revoked.
   * @param jti      The JWT ID claim from the token.
   * @param expiresAt When the token naturally expires (used for cleanup).
   */
  revoke(jti: string, expiresAt: Date): Promise<void>;

  /**
   * Check whether a token has been explicitly revoked.
   * @returns true if the token is in the revocation list.
   */
  isRevoked(jti: string): Promise<boolean>;

  /**
   * Delete all revocation records whose natural expiry has passed.
   * Should be called periodically (e.g. every hour) to keep the table small.
   */
  deleteExpired(): Promise<number>;
}
