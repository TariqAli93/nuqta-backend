import { FastifyPluginAsync } from "fastify";
import {
  GetAccountingSettingsUseCase,
  SetCompanySettingsUseCase,
  GetModuleSettingsUseCase,
  CompleteSetupWizardUseCase,
  UpdateSystemSettingsUseCase,
  UpdateAccountingSettingsUseCase,
  UpdatePosSettingsUseCase,
  UpdateBarcodeSettingsUseCase,
  CompleteSetupWizardV2UseCase,
  type CompanySettings,
  type UpdateSystemSettingsInput,
  type UpdateAccountingSettingsInput,
  type UpdatePosSettingsInput,
  type UpdateBarcodeSettingsInput,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const CompanySettingsSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    address: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    email: { type: "string", nullable: true },
    taxId: { type: "string", nullable: true },
    logo: { type: "string", nullable: true },
    currency: { type: "string" },
    lowStockThreshold: { type: "integer" },
  },
};

const UpdateCompanySettingsBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    address: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    email: { type: "string", format: "email", nullable: true },
    taxId: { type: "string", nullable: true },
    logo: { type: "string", nullable: true },
    currency: { type: "string", minLength: 3, maxLength: 3 },
    lowStockThreshold: { type: "integer", minimum: 0 },
  },
} as const;

const CurrencySettingsSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    currencyCode: { type: "string" },
    currencyName: { type: "string" },
    symbol: { type: "string" },
    exchangeRate: { type: "number" },
    isBaseCurrency: { type: "boolean" },
    isActive: { type: "boolean" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
  },
};

const ModuleSettingsDataSchema = {
  type: "object" as const,
  properties: {
    modules: {
      type: "object" as const,
      properties: {
        accountingEnabled: { type: "boolean" },
        purchasesEnabled: { type: "boolean" },
        ledgersEnabled: { type: "boolean" },
        unitsEnabled: { type: "boolean" },
        paymentsOnInvoicesEnabled: { type: "boolean" },
      },
    },
    notifications: {
      type: "object" as const,
      properties: {
        lowStockThreshold: { type: "integer" },
        expiryDays: { type: "integer" },
        debtReminderCount: { type: "integer" },
        debtReminderIntervalDays: { type: "integer" },
      },
    },
    invoice: {
      type: "object" as const,
      properties: {
        templateActiveId: { type: "string" },
        prefix: { type: "string" },
        paperSize: { type: "string" },
        footerNotes: { type: "string" },
        layoutDirection: { type: "string" },
        showQr: { type: "boolean" },
      },
    },
    wizardCompleted: { type: "boolean" },
  },
};

const KeyParamsSchema = {
  type: "object" as const,
  required: ["key"],
  properties: {
    key: { type: "string", minLength: 1, description: "Settings key" },
  },
} as const;

const SetSettingBodySchema = {
  type: "object" as const,
  required: ["value"],
  properties: {
    value: { type: "string", description: "Setting value" },
  },
  additionalProperties: false,
} as const;

const SetupWizardBodySchema = {
  type: "object" as const,
  properties: {
    modules: {
      type: "object" as const,
      properties: {
        accountingEnabled: { type: "boolean" },
        purchasesEnabled: { type: "boolean" },
        ledgersEnabled: { type: "boolean" },
        unitsEnabled: { type: "boolean" },
        paymentsOnInvoicesEnabled: { type: "boolean" },
      },
    },
    notifications: {
      type: "object" as const,
      properties: {
        lowStockThreshold: { type: "integer" },
        expiryDays: { type: "integer" },
        debtReminderCount: { type: "integer" },
        debtReminderIntervalDays: { type: "integer" },
      },
    },
    invoice: {
      type: "object" as const,
      properties: {
        templateActiveId: { type: "string" },
        prefix: { type: "string" },
        paperSize: { type: "string", enum: ["thermal", "a4", "a5"] },
        logo: { type: "string" },
        footerNotes: { type: "string" },
        layoutDirection: { type: "string", enum: ["rtl", "ltr"] },
        showQr: { type: "boolean" },
        showBarcode: { type: "boolean" },
      },
    },
  },
} as const;

const getCompanySettingsSchema = {
  tags: ["Settings"],
  summary: "Get company settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(CompanySettingsSchema, "Company settings"),
    ...ErrorResponses,
  },
} as const;

const updateCompanySettingsSchema = {
  tags: ["Settings"],
  summary: "Update company settings",
  security: [{ bearerAuth: [] }],
  body: UpdateCompanySettingsBodySchema,
  response: {
    200: successEnvelope(CompanySettingsSchema, "Updated settings"),
    ...ErrorResponses,
  },
} as const;

const getCurrencySettingsSchema = {
  tags: ["Settings"],
  summary: "Get currency settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(CurrencySettingsSchema, "Currency settings"),
    ...ErrorResponses,
  },
} as const;

const getModuleSettingsSchema = {
  tags: ["Settings"],
  summary: "Get module settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(ModuleSettingsDataSchema, "Module settings"),
    ...ErrorResponses,
  },
} as const;

const setupWizardSchema = {
  tags: ["Settings"],
  summary: "Complete setup wizard",
  description: "Save initial application settings from setup wizard.",
  security: [{ bearerAuth: [] }],
  body: SetupWizardBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: { completed: { type: "boolean" } },
      },
      "Wizard completed",
    ),
    ...ErrorResponses,
  },
} as const;

const getSettingByKeySchema = {
  tags: ["Settings"],
  summary: "Get setting by key",
  security: [{ bearerAuth: [] }],
  params: KeyParamsSchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Setting value",
    ),
    ...ErrorResponses,
  },
} as const;

const updateSettingByKeySchema = {
  tags: ["Settings"],
  summary: "Update setting by key",
  security: [{ bearerAuth: [] }],
  params: KeyParamsSchema,
  body: SetSettingBodySchema,
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// V2 Settings Schemas (Structured Tables)
// ═══════════════════════════════════════════════════════════════

const SystemSettingsDataSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    companyName: { type: "string" },
    companyAddress: { type: "string", nullable: true },
    companyPhone: { type: "string", nullable: true },
    companyPhone2: { type: "string", nullable: true },
    companyEmail: { type: "string", nullable: true },
    companyTaxId: { type: "string", nullable: true },
    companyLogo: { type: "string", nullable: true },
    defaultCurrency: { type: "string" },
    lowStockThreshold: { type: "integer" },
    accountingEnabled: { type: "boolean" },
    purchasesEnabled: { type: "boolean" },
    ledgersEnabled: { type: "boolean" },
    unitsEnabled: { type: "boolean" },
    paymentsOnInvoicesEnabled: { type: "boolean" },
    expiryAlertDays: { type: "integer" },
    debtReminderCount: { type: "integer" },
    debtReminderIntervalDays: { type: "integer" },
    setupWizardCompleted: { type: "boolean" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    updatedBy: { type: "integer", nullable: true },
  },
};

const AccountingSettingsDataSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    taxEnabled: { type: "boolean" },
    defaultTaxRate: { type: "number" },
    taxRegistrationNumber: { type: "string", nullable: true },
    fiscalYearStartMonth: { type: "integer" },
    fiscalYearStartDay: { type: "integer" },
    autoPosting: { type: "boolean" },
    costMethod: { type: "string" },
    currencyCode: { type: "string" },
    usdExchangeRate: { type: "number" },
    roundingMethod: { type: "string" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    updatedBy: { type: "integer", nullable: true },
  },
};

const PosSettingsDataSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoicePrefix: { type: "string" },
    invoiceTemplateId: { type: "string" },
    paperSize: { type: "string" },
    layoutDirection: { type: "string" },
    showQr: { type: "boolean" },
    showBarcode: { type: "boolean" },
    invoiceLogo: { type: "string" },
    invoiceFooterNotes: { type: "string" },
    defaultPrinterName: { type: "string", nullable: true },
    receiptHeader: { type: "string", nullable: true },
    receiptFooter: { type: "string", nullable: true },
    quickSaleEnabled: { type: "boolean" },
    soundEnabled: { type: "boolean" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    updatedBy: { type: "integer", nullable: true },
  },
};

const BarcodeSettingsDataSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    defaultBarcodeType: { type: "string" },
    defaultWidth: { type: "integer" },
    defaultHeight: { type: "integer" },
    showPrice: { type: "boolean" },
    showProductName: { type: "boolean" },
    showExpiryDate: { type: "boolean" },
    encoding: { type: "string" },
    printDpi: { type: "integer" },
    labelWidthMm: { type: "integer" },
    labelHeightMm: { type: "integer" },
    marginTop: { type: "integer" },
    marginBottom: { type: "integer" },
    marginLeft: { type: "integer" },
    marginRight: { type: "integer" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    updatedBy: { type: "integer", nullable: true },
  },
};

const getSystemSettingsSchema = {
  tags: ["Settings"],
  summary: "Get system settings (V2)",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(SystemSettingsDataSchema, "System settings"),
    ...ErrorResponses,
  },
} as const;

const updateSystemSettingsSchema = {
  tags: ["Settings"],
  summary: "Update system settings (V2)",
  security: [{ bearerAuth: [] }],
  body: { type: "object" as const, additionalProperties: true },
  response: {
    200: successEnvelope(SystemSettingsDataSchema, "Updated system settings"),
    ...ErrorResponses,
  },
} as const;

const getAccountingSettingsV2Schema = {
  tags: ["Settings"],
  summary: "Get accounting settings (V2)",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(AccountingSettingsDataSchema, "Accounting settings"),
    ...ErrorResponses,
  },
} as const;

const updateAccountingSettingsSchema = {
  tags: ["Settings"],
  summary: "Update accounting settings (V2)",
  security: [{ bearerAuth: [] }],
  body: { type: "object" as const, additionalProperties: true },
  response: {
    200: successEnvelope(
      AccountingSettingsDataSchema,
      "Updated accounting settings",
    ),
    ...ErrorResponses,
  },
} as const;

const getPosSettingsSchema = {
  tags: ["Settings"],
  summary: "Get POS settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(PosSettingsDataSchema, "POS settings"),
    ...ErrorResponses,
  },
} as const;

const updatePosSettingsSchema = {
  tags: ["Settings"],
  summary: "Update POS settings",
  security: [{ bearerAuth: [] }],
  body: { type: "object" as const, additionalProperties: true },
  response: {
    200: successEnvelope(PosSettingsDataSchema, "Updated POS settings"),
    ...ErrorResponses,
  },
} as const;

const getBarcodeSettingsSchema = {
  tags: ["Settings"],
  summary: "Get barcode settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(BarcodeSettingsDataSchema, "Barcode settings"),
    ...ErrorResponses,
  },
} as const;

const updateBarcodeSettingsSchema = {
  tags: ["Settings"],
  summary: "Update barcode settings",
  security: [{ bearerAuth: [] }],
  body: { type: "object" as const, additionalProperties: true },
  response: {
    200: successEnvelope(BarcodeSettingsDataSchema, "Updated barcode settings"),
    ...ErrorResponses,
  },
} as const;

const setupWizardV2Schema = {
  tags: ["Settings"],
  summary: "Complete setup wizard (V2)",
  description: "Save initial application settings using structured tables.",
  security: [{ bearerAuth: [] }],
  body: SetupWizardBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: { completed: { type: "boolean" } },
      },
      "Wizard completed",
    ),
    ...ErrorResponses,
  },
} as const;

const settings: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /settings/company
  fastify.get(
    "/company",
    { schema: getCompanySettingsSchema },
    async (request) => {
      const data = await fastify.settings.getCompany();
      return { ok: true, data };
    },
  );

  // PUT /settings/company
  fastify.put(
    "/company",
    {
      schema: updateCompanySettingsSchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const body = request.body as CompanySettings;
      const setUc = new SetCompanySettingsUseCase(fastify.repos.settings);
      await setUc.execute(body, String(request.user?.sub ?? "system"));
      const data = await fastify.settings.getCompany();
      return { ok: true, data };
    },
  );

  // GET /settings/currency
  fastify.get(
    "/currency",
    { schema: getCurrencySettingsSchema },
    async (request) => {
      const data = await fastify.settings.getCurrency();
      return { ok: true, data };
    },
  );

  // GET /settings/modules
  fastify.get(
    "/modules",
    { schema: getModuleSettingsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      const uc = new GetModuleSettingsUseCase(fastify.repos.settings);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // POST /settings/setup-wizard
  fastify.post(
    "/setup-wizard",
    { schema: setupWizardSchema },
    async (request) => {
      const body = request.body as any;
      const uc = new CompleteSetupWizardUseCase(fastify.repos.settings);
      await uc.execute(body, String(request.user?.sub ?? "system"));
      return { ok: true, data: { completed: true } };
    },
  );

  // GET /settings/:key
  fastify.get<{ Params: { key: string } }>(
    "/:key",
    { schema: getSettingByKeySchema },
    async (request) => {
      console.log("Fetching setting for key:", request.params);
      const data = await fastify.settings.getValue(request.params.key);
      return { ok: true, data };
    },
  );

  // PUT /settings/:key
  fastify.put<{ Params: { key: string }; Body: { value: string } }>(
    "/:key",
    {
      schema: updateSettingByKeySchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const { key } = request.params;
      const { value } = request.body;
      await fastify.settings.setValue(key, value);
      return { ok: true, data: null };
    },
  );

  // GET /settings/accounting (legacy KV-based)
  fastify.get("/accounting", async (request) => {
    const uc = new GetAccountingSettingsUseCase(fastify.repos.settings);
    const data = await uc.execute();
    return { ok: true, data };
  });

  // ═══════════════════════════════════════════════════════════════
  // V2 Routes — Structured Settings Tables
  // ═══════════════════════════════════════════════════════════════

  // GET /settings/system
  fastify.get("/system", { schema: getSystemSettingsSchema }, async () => {
    const data = await fastify.settings.getSystem();
    return { ok: true, data };
  });

  // PUT /settings/system
  fastify.put(
    "/system",
    {
      schema: updateSystemSettingsSchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const body = request.body as UpdateSystemSettingsInput;
      const uc = new UpdateSystemSettingsUseCase(fastify.repos.systemSettings);
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // GET /settings/accounting-v2
  fastify.get(
    "/accounting-v2",
    { schema: getAccountingSettingsV2Schema },
    async () => {
      const data = await fastify.settings.getAccounting();
      return { ok: true, data };
    },
  );

  // PUT /settings/accounting-v2
  fastify.put(
    "/accounting-v2",
    {
      schema: updateAccountingSettingsSchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const body = request.body as UpdateAccountingSettingsInput;
      const uc = new UpdateAccountingSettingsUseCase(
        fastify.repos.accountingSettings,
      );
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // GET /settings/pos
  fastify.get("/pos", { schema: getPosSettingsSchema }, async () => {
    const data = await fastify.settings.getPos();
    return { ok: true, data };
  });

  // PUT /settings/pos
  fastify.put(
    "/pos",
    {
      schema: updatePosSettingsSchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const body = request.body as UpdatePosSettingsInput;
      const uc = new UpdatePosSettingsUseCase(fastify.repos.posSettings);
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // GET /settings/barcode-config
  fastify.get(
    "/barcode-config",
    { schema: getBarcodeSettingsSchema },
    async () => {
      const data = await fastify.settings.getBarcode();
      return { ok: true, data };
    },
  );

  // PUT /settings/barcode-config
  fastify.put(
    "/barcode-config",
    {
      schema: updateBarcodeSettingsSchema,
      preHandler: requirePermission("settings:update"),
    },
    async (request) => {
      const body = request.body as UpdateBarcodeSettingsInput;
      const uc = new UpdateBarcodeSettingsUseCase(
        fastify.repos.barcodeSettings,
      );
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // POST /settings/setup-wizard-v2
  fastify.post(
    "/setup-wizard-v2",
    { schema: setupWizardV2Schema },
    async (request) => {
      const body = request.body as any;
      const uc = new CompleteSetupWizardV2UseCase(
        fastify.repos.systemSettings,
        fastify.repos.posSettings,
      );
      await uc.execute(body, String(request.user?.sub ?? "system"));
      return { ok: true, data: { completed: true } };
    },
  );
};

export default settings;
