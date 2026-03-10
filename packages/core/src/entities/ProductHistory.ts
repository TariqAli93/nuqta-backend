export interface PurchaseHistoryItem {
  id: number;
  purchaseId: number;
  invoiceNumber: string;
  quantity: number;
  unitName: string;
  unitFactor: number;
  quantityBase: number;
  unitCost: number;
  lineSubtotal: number;
  batchId: number | null;
  expiryDate: string | null;
  createdAt: string;
  supplierName: string | null;
}

export interface SalesHistoryItem {
  id: number;
  saleId: number;
  invoiceNumber: string;
  quantity: number;
  unitName: string;
  unitFactor: number;
  quantityBase: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  customerName: string | null;
}
