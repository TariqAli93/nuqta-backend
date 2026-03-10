/**
 * PermissionService
 * Maps roles to permissions and provides permission checking.
 * Implements the backend permission matrix for RBAC enforcement.
 */

export type UserRole = "admin" | "manager" | "cashier" | "viewer";

/**
 * Backend Permission Matrix
 * Canonical RBAC permission mapping for every API endpoint.
 * Format: permission -> array of roles allowed
 */
const PERMISSION_MATRIX: Record<string, UserRole[]> = {
  // ── Sales ──────────────────────────────────────────────────────────
  "sales:create": ["admin", "manager", "cashier"],
  "sales:read": ["admin", "manager", "cashier", "viewer"],
  "sales:update": ["admin", "manager", "cashier"],
  "sales:delete": ["admin", "manager"],
  "sales:cancel": ["admin", "manager"],
  "sales:refund": ["admin", "manager"],
  "sales:payment": ["admin", "manager", "cashier"],
  "sales:receipt": ["admin", "manager", "cashier", "viewer"],

  // ── Products ───────────────────────────────────────────────────────
  "products:create": ["admin", "manager"],
  "products:read": ["admin", "manager", "cashier", "viewer"],
  "products:update": ["admin", "manager"],
  "products:delete": ["admin", "manager"],

  // ── Customers ──────────────────────────────────────────────────────
  "customers:create": ["admin", "manager", "cashier"],
  "customers:read": ["admin", "manager", "cashier", "viewer"],
  "customers:update": ["admin", "manager", "cashier"],
  "customers:delete": ["admin", "manager"],

  // ── Categories ─────────────────────────────────────────────────────
  "categories:create": ["admin", "manager"],
  "categories:read": ["admin", "manager", "cashier", "viewer"],
  "categories:update": ["admin", "manager"],
  "categories:delete": ["admin", "manager"],

  // ── Users ──────────────────────────────────────────────────────────
  "users:create": ["admin"],
  "users:read": ["admin"],
  "users:update": ["admin"],
  "users:delete": ["admin"],

  // ── Settings ───────────────────────────────────────────────────────
  "settings:read": ["admin", "manager"],
  "settings:update": ["admin"],

  // ── Dashboard ──────────────────────────────────────────────────────
  "dashboard:read": ["admin", "manager", "cashier", "viewer"],

  // ── Inventory ──────────────────────────────────────────────────────
  "inventory:read": ["admin", "manager", "cashier", "viewer"],
  "inventory:update": ["admin", "manager"],
  "inventory:reconcile": ["admin", "manager"],

  // ── Purchases ──────────────────────────────────────────────────────
  "purchases:create": ["admin", "manager"],
  "purchases:read": ["admin", "manager", "cashier", "viewer"],
  "purchases:update": ["admin", "manager"],
  "purchases:delete": ["admin", "manager"],

  // ── Suppliers ──────────────────────────────────────────────────────
  "suppliers:create": ["admin", "manager"],
  "suppliers:read": ["admin", "manager", "cashier", "viewer"],
  "suppliers:update": ["admin", "manager"],
  "suppliers:delete": ["admin", "manager"],

  // ── Accounting ─────────────────────────────────────────────────────
  "accounting:read": ["admin", "manager"],
  "accounting:update": ["admin"],
  "hr:read": ["admin", "manager"],
  "hr:update": ["admin", "manager"],
  "payroll:read": ["admin", "manager"],
  "payroll:update": ["admin", "manager"],
  "payroll:approve": ["admin", "manager"],

  // ── Posting ────────────────────────────────────────────────────────
  "posting:create": ["admin", "manager"],
  "posting:read": ["admin", "manager"],
  "posting:update": ["admin", "manager"],
  "posting:lock": ["admin"],
  "posting:unlock": ["admin"],

  // ── Ledger (Customer & Supplier) ───────────────────────────────────
  "ledger:read": ["admin", "manager", "cashier", "viewer"],
  "ledger:payment": ["admin", "manager", "cashier"],
  "ledger:adjust": ["admin", "manager"],

  // ── Barcode ────────────────────────────────────────────────────────
  "barcode:read": ["admin", "manager", "cashier"],
  "barcode:create": ["admin", "manager"],
  "barcode:update": ["admin", "manager"],
  "barcode:delete": ["admin", "manager"],
  "barcode:print": ["admin", "manager", "cashier"],

  // ── Audit ──────────────────────────────────────────────────────────
  "audit:read": ["admin", "manager"],
  "audit:cleanup": ["admin"],
  "audit:export": ["admin", "manager"],

  // ── Backup / Restore ──────────────────────────────────────────────
  "backup:create": ["admin"],
  "backup:restore": ["admin"],
  "backup:read": ["admin"],
  "backup:delete": ["admin"],

  // ── POS ────────────────────────────────────────────────────────────
  "pos:create": ["admin", "manager", "cashier"],

  // ── Simple mode ────────────────────────────────────────────────────
  "simpleMode:toggle": ["admin", "manager"],
};

export class PermissionService {
  /**
   * Get all permissions for a given role
   */
  static getPermissionsForRole(role: UserRole): string[] {
    const permissions: string[] = [];

    for (const [permission, allowedRoles] of Object.entries(
      PERMISSION_MATRIX,
    )) {
      if (allowedRoles.includes(role)) {
        permissions.push(permission);
      }
    }

    return permissions;
  }

  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: UserRole, permission: string): boolean {
    const allowedRoles = PERMISSION_MATRIX[permission];
    return allowedRoles ? allowedRoles.includes(role) : false;
  }

  /**
   * Check if a role has any of the provided permissions (OR logic)
   */
  static hasAnyPermission(role: UserRole, permissions: string[]): boolean {
    return permissions.some((permission) =>
      this.hasPermission(role, permission),
    );
  }

  /**
   * Check if a role has all of the provided permissions (AND logic)
   */
  static hasAllPermissions(role: UserRole, permissions: string[]): boolean {
    return permissions.every((permission) =>
      this.hasPermission(role, permission),
    );
  }

  /**
   * Get all available permissions in the system
   */
  static getAllPermissions(): string[] {
    return Object.keys(PERMISSION_MATRIX);
  }

  /**
   * Get all available roles
   */
  static getAllRoles(): UserRole[] {
    return ["admin", "manager", "cashier", "viewer"];
  }
}
