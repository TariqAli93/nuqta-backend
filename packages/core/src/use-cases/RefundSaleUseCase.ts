/**
 * RefundSaleUseCase
 * Records a partial or full refund on a sale.
 * Updates paidAmount and remainingAmount accordingly.
 */
import { ISaleRepository } from "../interfaces/ISaleRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ValidationError,
} from "../errors/DomainErrors.js";

export interface RefundInput {
  saleId: number;
  amount: number;
  reason?: string;
}

export class RefundSaleUseCase {
  constructor(private saleRepo: ISaleRepository) {}

  async execute(input: RefundInput, userId: number) {
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
}
