import type { Account } from "../../entities/Accounting.js";
import type { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import type { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/DomainErrors.js";
import { AuditService } from "../../shared/services/AuditService.js";

export interface CreateAccountInput {
  code: string;
  name: string;
  nameAr: string;
  accountType: Account["accountType"];
  parentId?: number | null;
}

export class CreateAccountUseCase extends WriteUseCase<
  CreateAccountInput,
  Account,
  Account
> {
  constructor(
    private accountingRepo: IAccountingRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(
    input: CreateAccountInput,
    _userId: string,
  ): Promise<Account> {
    if (!input.code || !input.code.trim()) {
      throw new ValidationError("Account code is required");
    }
    if (!input.name || !input.name.trim()) {
      throw new ValidationError("Account name is required");
    }

    const existing = await this.accountingRepo.findAccountByCode(input.code);
    if (existing) {
      throw new ConflictError(
        `Account with code '${input.code}' already exists`,
      );
    }

    if (input.parentId != null) {
      const parent = await this.accountingRepo.findAccountById(input.parentId);
      if (!parent) {
        throw new NotFoundError(
          `Parent account with id ${input.parentId} not found`,
        );
      }
    }

    return this.accountingRepo.createAccountSync({
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr ?? "",
      accountType: input.accountType,
      parentId: input.parentId ?? null,
      isSystem: false,
      isActive: true,
      balance: 0,
    });
  }

  async executeSideEffectsPhase(
    result: Account,
    userId: string,
  ): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await new AuditService(this.auditRepo).logAction(
        Number(userId),
        "account.created",
        "account",
        result.id!,
        `Created account ${result.code} - ${result.name}`,
      );
    } catch (err) {
      console.warn("[Audit] Failed to log account creation:", err);
    }
  }

  toEntity(result: Account): Account {
    return result;
  }
}
