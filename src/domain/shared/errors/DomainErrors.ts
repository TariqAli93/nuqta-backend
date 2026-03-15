/**
 * Domain Error Classes
 * Typed errors for use cases following Clean Architecture principles.
 * Each error type maps to an HTTP status code for proper IPC response mapping.
 */

export class DomainError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 400,
    public details?: any,
  ) {
    super(message);
    this.name = "DomainError";
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/**
 * ValidationError (400)
 * Thrown when input validation fails (bad request payload, missing required fields, etc)
 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: any) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * NotFoundError (404)
 * Thrown when a requested resource (sale, product, user, etc) does not exist
 */
export class NotFoundError extends DomainError {
  constructor(message: string, details?: any) {
    super("NOT_FOUND", message, 404, details);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * PermissionDeniedError (403)
 * Thrown when user lacks required permission to perform action
 */
export class PermissionDeniedError extends DomainError {
  constructor(message: string, details?: any) {
    super("PERMISSION_DENIED", message, 403, details);
    this.name = "PermissionDeniedError";
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

/**
 * ConflictError (409)
 * Thrown when operation conflicts with current state (e.g., duplicate entry, state mismatch)
 */
export class ConflictError extends DomainError {
  constructor(message: string, details?: any) {
    super("CONFLICT", message, 409, details);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * UnauthorizedError (401)
 * Thrown when user is not authenticated or credentials are invalid
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string, details?: any) {
    super("UNAUTHORIZED", message, 401, details);
    this.name = "UnauthorizedError";
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * InsufficientStockError (409)
 * Thrown when product stock is insufficient for transaction
 */
export class InsufficientStockError extends DomainError {
  constructor(message: string, details?: any) {
    super("INSUFFICIENT_STOCK", message, 409, details);
    this.name = "InsufficientStockError";
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

/**
 * InvalidStateError (409)
 * Thrown when operation is invalid for current entity state (e.g., cancelling closed sale)
 */
export class InvalidStateError extends DomainError {
  constructor(message: string, details?: any) {
    super("INVALID_STATE", message, 409, details);
    this.name = "InvalidStateError";
    Object.setPrototypeOf(this, InvalidStateError.prototype);
  }
}

/**
 * Type guard to check if error is a DomainError
 */
export function isDomainError(error: any): error is DomainError {
  return error instanceof DomainError;
}
