export interface PaymentAllocation {
  id?: number;
  paymentId: number;
  saleId: number;
  amount: number;
  createdAt?: string;
}
