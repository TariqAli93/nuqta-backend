/**
 * ChangePasswordUseCase
 * Allows an authenticated user to change their own password.
 * Validates the current password before accepting the new one.
 */
import { IUserRepository } from "../interfaces/IUserRepository.js";
import { UnauthorizedError, ValidationError } from "../errors/DomainErrors.js";
import { comparePassword, hashPassword } from "../utils/helpers.js";

export interface ChangePasswordInput {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepo.findById(input.userId);

    if (!user) {
      throw new UnauthorizedError("المستخدم غير موجود");
    }

    const isValid = await comparePassword(input.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedError("كلمة المرور الحالية غير صحيحة");
    }

    if (input.newPassword.length < 6) {
      throw new ValidationError(
        "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
      );
    }

    const hashedPassword = await hashPassword(input.newPassword);
    await this.userRepo.update(input.userId, { password: hashedPassword });
  }
}
