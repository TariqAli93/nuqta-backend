/**
 * RefundSaleUseCase
 * Records a partial or full refund on a sale.
 * Updates paidAmount and remainingAmount accordingly.
 */
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export interface RefundInput {
  saleId: number;
  amount: number;
  reason?: string;
}

type TEntity = { saleId: number; refundedAmount: number; newPaidAmount: number; newRemainingAmount: number };

export class RefundSaleUseCase extends WriteUseCase<RefundInput, TEntity, TEntity> {
  constructor(private saleRepo: ISaleRepository) {
    super();
  }

  async executeCommitPhase(input: RefundInput, _userId: string): Promise<TEntity> {
    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    if (sale.status === "cancelled") {
      throw new InvalidStateError("لا يمكن استرداد فاتورة ملغية");
    }

    if (input.amount <= 0) {
      throw new ValidationError("مبلغ الاسترداد يجب أن يكون أكبر من صفر");
    }

    if (input.amount > (sale.paidAmount ?? 0)) {
      throw new ValidationError("مبلغ الاسترداد أكبر من المبلغ المدفوع");
    }

    const newPaidAmount = (sale.paidAmount ?? 0) - input.amount;
    const newRemainingAmount = (sale.total ?? 0) - newPaidAmount;

    await this.saleRepo.update(input.saleId, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      notes: sale.notes
        ? `${sale.notes}\nاسترداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}`
        : `استرداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}`,
    });

    return {
      saleId: input.saleId,
      refundedAmount: input.amount,
      newPaidAmount,
      newRemainingAmount,
    };
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
