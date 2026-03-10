import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  UnauthorizedError,
  ValidationError,
} from "../../../packages/core/src/shared/errors/DomainErrors.ts";

const comparePasswordMock = vi.hoisted(() => vi.fn());

vi.mock("../../../packages/core/src/shared/utils/helpers.js", () => ({
  comparePassword: comparePasswordMock,
}));

describe("LoginUseCase", () => {
  const userRepo = {
    findByUsername: vi.fn(),
    updateLastLogin: vi.fn(),
  };

  beforeEach(() => {
    comparePasswordMock.mockReset();
    userRepo.findByUsername.mockReset();
    userRepo.updateLastLogin.mockReset();
  });

  test("rejects missing users", async () => {
    const { LoginUseCase } =
      await import("../../../packages/core/src/use-cases/auth/LoginUseCase.ts");
    userRepo.findByUsername.mockResolvedValue(null);

    const useCase = new LoginUseCase(userRepo as never);

    await expect(
      useCase.execute({ username: "admin", password: "secret" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("rejects inactive users", async () => {
    const { LoginUseCase } =
      await import("../../../packages/core/src/use-cases/auth/LoginUseCase.ts");
    userRepo.findByUsername.mockResolvedValue({
      id: 1,
      username: "admin",
      password: "hash",
      fullName: "Admin User",
      phone: "7700000000",
      role: "admin",
      isActive: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    const useCase = new LoginUseCase(userRepo as never);

    await expect(
      useCase.execute({ username: "admin", password: "secret" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // ── Covers L27: wrong password → UnauthorizedError ──
  test("rejects when password does not match", async () => {
    const { LoginUseCase } =
      await import("../../../packages/core/src/use-cases/auth/LoginUseCase.ts");
    userRepo.findByUsername.mockResolvedValue({
      id: 1,
      username: "admin",
      password: "hash",
      fullName: "Admin User",
      phone: "7700000000",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    comparePasswordMock.mockResolvedValue(false);

    const useCase = new LoginUseCase(userRepo as never);

    await expect(
      useCase.execute({ username: "admin", password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("returns a safe user plus permissions on success", async () => {
    const { LoginUseCase } =
      await import("../../../packages/core/src/use-cases/auth/LoginUseCase.ts");
    userRepo.findByUsername.mockResolvedValue({
      id: 1,
      username: "admin",
      password: "hash",
      fullName: "Admin User",
      phone: "7700000000",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    comparePasswordMock.mockResolvedValue(true);

    const useCase = new LoginUseCase(userRepo as never);
    const result = await useCase.execute({
      username: "admin",
      password: "secret",
    });

    expect(result.user).toMatchObject({
      id: 1,
      username: "admin",
      fullName: "Admin User",
      role: "admin",
    });
    expect(result.permissions).toContain("users:create");
    expect(userRepo.updateLastLogin).toHaveBeenCalledWith(1);
  });
});
