import { describe, expect, test } from "vitest";
import { PermissionService } from "../../../packages/core/src/shared/services/PermissionService.ts";

describe("PermissionService", () => {
  test("returns the permissions for a role", () => {
    const permissions = PermissionService.getPermissionsForRole("admin");

    expect(permissions).toContain("users:create");
    expect(permissions).toContain("settings:update");
  });

  test("checks individual and combined permissions", () => {
    expect(PermissionService.hasPermission("viewer", "products:read")).toBe(
      true,
    );
    expect(PermissionService.hasPermission("viewer", "settings:update")).toBe(
      false,
    );
    expect(
      PermissionService.hasAnyPermission("cashier", [
        "settings:update",
        "sales:create",
      ]),
    ).toBe(true);
    expect(
      PermissionService.hasAllPermissions("manager", [
        "products:create",
        "suppliers:update",
      ]),
    ).toBe(true);
  });

  // ── Covers L134-137: getAllPermissions() ──
  test("getAllPermissions returns all registered permission keys", () => {
    const all = PermissionService.getAllPermissions();
    expect(all.length).toBeGreaterThan(10);
    expect(all).toContain("sales:create");
    expect(all).toContain("users:delete");
    expect(all).toContain("accounting:read");
    expect(all).toContain("payroll:approve");
  });

  // ── Covers L138-141: getAllRoles() ──
  test("getAllRoles returns exactly four roles", () => {
    expect(PermissionService.getAllRoles()).toEqual([
      "admin",
      "manager",
      "cashier",
      "viewer",
    ]);
  });

  // ── Covers hasPermission false-branch for unknown permission ──
  test("hasPermission returns false for non-existent permission", () => {
    expect(PermissionService.hasPermission("admin", "nonexistent:action")).toBe(
      false,
    );
  });

  // ── Covers L100 both branches: viewer has few permissions so most iterations skip ──
  test("getPermissionsForRole iterates all entries, hitting both include-true and include-false", () => {
    const viewerPerms = PermissionService.getPermissionsForRole("viewer");
    const allPerms = PermissionService.getAllPermissions();
    // Viewer has a strict subset → proves both branches of includes() were taken
    expect(viewerPerms.length).toBeGreaterThan(0);
    expect(viewerPerms.length).toBeLessThan(allPerms.length);
  });

  // ── Covers hasAnyPermission returning false (no match at all) ──
  test("hasAnyPermission returns false when role has none of the permissions", () => {
    expect(
      PermissionService.hasAnyPermission("viewer", [
        "users:create",
        "settings:update",
      ]),
    ).toBe(false);
  });

  // ── Covers hasAllPermissions returning false (partial match) ──
  test("hasAllPermissions returns false when role lacks at least one permission", () => {
    expect(
      PermissionService.hasAllPermissions("cashier", [
        "sales:create",
        "users:delete",
      ]),
    ).toBe(false);
  });
});
