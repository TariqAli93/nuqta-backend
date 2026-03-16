// ── Shared: Contracts, Errors, Services, Utils ──
export * from "./shared/contracts/contract.js";
export * from "./shared/errors/DomainErrors.js";
export * from "./shared/errors/error-codes.js";
export * from "./shared/services/PermissionService.js";
export * from "./shared/services/AuditService.js";
export * from "./shared/services/JwtService.js";
export * from "./shared/services/FifoDepletionService.js";
export * from "./shared/services/SettingsAccessor.js";
export * from "./shared/services/UnifiedSettingsService.js";
export * from "./shared/utils/helpers.js";

// ── Entities ──
export * from "./entities/Accounting.js";
export * from "./entities/AuditEvent.js";
export * from "./entities/Barcode.js";
export * from "./entities/Category.js";
export * from "./entities/Customer.js";
export * from "./entities/Employee.js";
export * from "./entities/InventoryMovement.js";
export * from "./entities/Ledger.js";
export * from "./entities/ModuleSettings.js";
export * from "./entities/Payment.js";
export * from "./entities/Payroll.js";
export * from "./entities/PostingBatch.js";
export * from "./entities/Product.js";
export * from "./entities/ProductBatch.js";
export * from "./entities/ProductHistory.js";
export * from "./entities/ProductUnit.js";
export * from "./entities/Purchase.js";
export * from "./entities/Sale.js";
export * from "./entities/SaleReceipt.js";
export * from "./entities/Settings.js";
export * from "./entities/SystemSettings.js";
export * from "./entities/AccountingSettings.js";
export * from "./entities/PosSettings.js";
export * from "./entities/BarcodeSettings.js";
export * from "./entities/Supplier.js";
export * from "./entities/User.js";

// ── Interfaces ──
export * from "./interfaces/IAccountingRepository.js";
export * from "./interfaces/IAuditRepository.js";
export * from "./interfaces/IBackupRepository.js";
export * from "./interfaces/IBarcodeRepository.js";
export * from "./interfaces/ICategoryRepository.js";
export * from "./interfaces/ICustomerLedgerRepository.js";
export * from "./interfaces/ICustomerRepository.js";
export * from "./interfaces/IEmployeeRepository.js";
export * from "./interfaces/IInventoryRepository.js";
export * from "./interfaces/IPaymentRepository.js";
export * from "./interfaces/IPayrollRepository.js";
export * from "./interfaces/IPostingRepository.js";
export * from "./interfaces/IProductRepository.js";
export * from "./interfaces/IProductWorkspaceRepository.js";
export * from "./interfaces/IPurchaseRepository.js";
export * from "./interfaces/ISaleRepository.js";
export * from "./interfaces/ISettingsRepository.js";
export * from "./interfaces/ISystemSettingsRepository.js";
export * from "./interfaces/IAccountingSettingsRepository.js";
export * from "./interfaces/IPosSettingsRepository.js";
export * from "./interfaces/IBarcodeSettingsRepository.js";
export * from "./interfaces/ISupplierLedgerRepository.js";
export * from "./interfaces/ISupplierRepository.js";
export * from "./interfaces/IUserRepository.js";

// ── Use Cases: Accounting ──
export * from "./use-cases/accounting/InitializeAccountingUseCase.js";

// ── Use Cases: Auth ──
export * from "./use-cases/auth/ChangePasswordUseCase.js";
export * from "./use-cases/auth/CheckInitialSetupUseCase.js";
export * from "./use-cases/auth/LoginUseCase.js";
export * from "./use-cases/auth/LogoutUseCase.js";
export * from "./use-cases/auth/RegisterFirstUserUseCase.js";

// ── Use Cases: Backup ──
export * from "./use-cases/backup/CreateBackupUseCase.js";
export * from "./use-cases/backup/DeleteBackupUseCase.js";
export * from "./use-cases/backup/GenerateBackupTokenUseCase.js";
export * from "./use-cases/backup/GetBackupStatsUseCase.js";
export * from "./use-cases/backup/ListBackupsUseCase.js";
export * from "./use-cases/backup/RestoreBackupUseCase.js";

// ── Use Cases: Categories ──
export * from "./use-cases/categories/CreateCategoryUseCase.js";
export * from "./use-cases/categories/UpdateCategoryUseCase.js";

// ── Use Cases: Customer Ledger ──
export * from "./use-cases/customer-ledger/AddCustomerLedgerAdjustmentUseCase.js";
export * from "./use-cases/customer-ledger/ReconcileCustomerDebtUseCase.js";
export * from "./use-cases/customer-ledger/RecordCustomerPaymentUseCase.js";

// ── Use Cases: Customers ──
export * from "./use-cases/customers/CreateCustomerUseCase.js";
export * from "./use-cases/customers/GetCustomerByIdUseCase.js";
export * from "./use-cases/customers/UpdateCustomerUseCase.js";

// ── Use Cases: Dashboard ──
export * from "./use-cases/dashboard/GetDashboardStatsUseCase.js";

// ── Use Cases: HR ──
export * from "./use-cases/hr/ApprovePayrollRunUseCase.js";
export * from "./use-cases/hr/CancelPayrollUseCase.js";
export * from "./use-cases/hr/CreateEmployeeUseCase.js";
export * from "./use-cases/hr/CreatePayrollRunUseCase.js";
export * from "./use-cases/hr/DisbursePayrollUseCase.js";
export * from "./use-cases/hr/GetEmployeeByIdUseCase.js";
export * from "./use-cases/hr/GetPayrollRunByIdUseCase.js";
export * from "./use-cases/hr/SubmitPayrollUseCase.js";
export * from "./use-cases/hr/UpdateEmployeeUseCase.js";

// ── Use Cases: Inventory ──
export * from "./use-cases/inventory/GetExpiryAlertsUseCase.js";
export * from "./use-cases/inventory/GetInventoryDashboardUseCase.js";
export * from "./use-cases/inventory/GetInventoryMovementsUseCase.js";
export * from "./use-cases/inventory/ReconcileStockUseCase.js";

// ── Use Cases: Posting ──
export * from "./use-cases/posting/LockPostingBatchUseCase.js";
export * from "./use-cases/posting/PostIndividualEntryUseCase.js";
export * from "./use-cases/posting/PostPeriodUseCase.js";
export * from "./use-cases/posting/ReverseEntryUseCase.js";
export * from "./use-cases/posting/UnlockPostingBatchUseCase.js";
export * from "./use-cases/posting/UnpostIndividualEntryUseCase.js";

// ── Use Cases: Products ──
export * from "./use-cases/products/AdjustProductStockUseCase.js";
export * from "./use-cases/products/CreateProductBatchUseCase.js";
export * from "./use-cases/products/CreateProductUnitUseCase.js";
export * from "./use-cases/products/CreateProductUseCase.js";
export * from "./use-cases/products/DeleteProductUseCase.js";
export * from "./use-cases/products/GetProductByIdUseCase.js";
export * from "./use-cases/products/GetProductPurchaseHistoryUseCase.js";
export * from "./use-cases/products/GetProductSalesHistoryUseCase.js";
export * from "./use-cases/products/GetProductsUseCase.js";
export * from "./use-cases/products/SetDefaultProductUnitUseCase.js";
export * from "./use-cases/products/UpdateProductUnitUseCase.js";
export * from "./use-cases/products/UpdateProductUseCase.js";

// ── Use Cases: Purchases ──
export * from "./use-cases/purchases/AddPurchasePaymentUseCase.js";
export * from "./use-cases/purchases/CreatePurchaseUseCase.js";

// ── Use Cases: Sales ──
export * from "./use-cases/sales/AddPaymentUseCase.js";
export * from "./use-cases/sales/CancelSaleUseCase.js";
export * from "./use-cases/sales/CreateSaleUseCase.js";
export * from "./use-cases/sales/GetSaleReceiptUseCase.js";
export * from "./use-cases/sales/GetSaleUseCase.js";
export * from "./use-cases/sales/RefundSaleUseCase.js";

// ── Use Cases: Settings ──
export * from "./use-cases/settings/CompleteSetupWizardUseCase.js";
export * from "./use-cases/settings/GetModuleSettingsUseCase.js";
export * from "./use-cases/settings/SetCompanySettingsUseCase.js";
export * from "./use-cases/settings/GetAccountingSettingsUseCase.js";
export * from "./use-cases/settings/UpdateSystemSettingsUseCase.js";
export * from "./use-cases/settings/UpdateAccountingSettingsUseCase.js";
export * from "./use-cases/settings/UpdatePosSettingsUseCase.js";
export * from "./use-cases/settings/UpdateBarcodeSettingsUseCase.js";
export * from "./use-cases/settings/CompleteSetupWizardV2UseCase.js";

// ── Use Cases: Supplier Ledger ──
export * from "./use-cases/supplier-ledger/ReconcileSupplierBalanceUseCase.js";
export * from "./use-cases/supplier-ledger/RecordSupplierPaymentUseCase.js";

// ── Use Cases: Suppliers ──
export * from "./use-cases/suppliers/CreateSupplierUseCase.js";
export * from "./use-cases/suppliers/UpdateSupplierUseCase.js";

// ── Use Cases: System ──
export * from "./use-cases/system/InitializeAppUseCase.js";

// ── Use Cases: Users ──
export * from "./use-cases/users/CreateUserUseCase.js";
export * from "./use-cases/users/GetUserByIdUseCase.js";
export * from "./use-cases/users/UpdateUserUseCase.js";
