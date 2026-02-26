/**
 * PermissionService
 * Maps roles to permissions and provides permission checking.
 * Implements the backend permission matrix for RBAC enforcement.
 */

export type UserRole = 'admin' | 'manager' | 'cashier' | 'viewer';

/**
 * Backend Permission Matrix
 * Mirrors the frontend permissionMatrix.js for consistency
 * Format: permission -> array of roles allowed
 */
const PERMISSION_MATRIX: Record<string, UserRole[]> = {
  // Sales permissions
  'sales:create': ['admin', 'manager', 'cashier'],
  'sales:read': ['admin', 'manager', 'cashier', 'viewer'],
  'sales:update': ['admin', 'manager', 'cashier'],
  'sales:delete': ['admin', 'manager'],
  'sales:cancel': ['admin', 'manager'],
  'sales:refund': ['admin', 'manager'],
  'sales:addPayment': ['admin', 'manager', 'cashier'],

  // Products permissions
  'products:create': ['admin', 'manager'],
  'products:read': ['admin', 'manager', 'cashier', 'viewer'],
  'products:update': ['admin', 'manager'],
  'products:delete': ['admin', 'manager'],

  // Customers permissions
  'customers:create': ['admin', 'manager', 'cashier'],
  'customers:read': ['admin', 'manager', 'cashier', 'viewer'],
  'customers:update': ['admin', 'manager', 'cashier'],
  'customers:delete': ['admin', 'manager'],

  // Categories permissions
  'categories:create': ['admin', 'manager'],
  'categories:read': ['admin', 'manager', 'cashier', 'viewer'],
  'categories:update': ['admin', 'manager'],
  'categories:delete': ['admin', 'manager'],

  // User management permissions
  'users:create': ['admin'],
  'users:read': ['admin'],
  'users:update': ['admin'],
  'users:delete': ['admin'],

  // Settings permissions
  'settings:read': ['admin', 'manager'],
  'settings:update': ['admin'],

  // Dashboard permissions
  'dashboard:view': ['admin', 'manager', 'cashier', 'viewer'],

  // Backup/Restore permissions
  'backup:create': ['admin'],
  'backup:restore': ['admin'],
  'backup:list': ['admin'],
  'backup:delete': ['admin'],

  // Audit permissions
  'audit:read': ['admin', 'manager'],
  'audit:cleanup': ['admin'],
  'audit:export': ['admin', 'manager'],

  // Inventory permissions
  'inventory:view': ['admin', 'manager', 'cashier', 'viewer'],
  'inventory:update': ['admin', 'manager'],

  // Purchases permissions
  'purchases:create': ['admin', 'manager'],
  'purchases:read': ['admin', 'manager', 'cashier', 'viewer'],
  'purchases:update': ['admin', 'manager'],
  'purchases:delete': ['admin', 'manager'],

  // Suppliers permissions
  'suppliers:create': ['admin', 'manager'],
  'suppliers:read': ['admin', 'manager', 'cashier', 'viewer'],
  'suppliers:update': ['admin', 'manager'],
  'suppliers:delete': ['admin', 'manager'],

  // Accounting permissions
  'accounting:view': ['admin', 'manager'],
  'accounting:update': ['admin'],

  // Simple mode permissions
  'simpleMode:toggle': ['admin', 'manager'],

  // Additional permissions can be added here
};

export class PermissionService {
  /**
   * Get all permissions for a given role
   */
  static getPermissionsForRole(role: UserRole): string[] {
    const permissions: string[] = [];

    for (const [permission, allowedRoles] of Object.entries(PERMISSION_MATRIX)) {
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
    return permissions.some((permission) => this.hasPermission(role, permission));
  }

  /**
   * Check if a role has all of the provided permissions (AND logic)
   */
  static hasAllPermissions(role: UserRole, permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(role, permission));
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
    return ['admin', 'manager', 'cashier', 'viewer'];
  }
}
