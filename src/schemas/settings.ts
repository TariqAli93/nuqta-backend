/**
 * Settings domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "./common.js";

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
    accountingEnabled: { type: "boolean" },
    purchasesEnabled: { type: "boolean" },
    ledgersEnabled: { type: "boolean" },
    unitsEnabled: { type: "boolean" },
    paymentsOnInvoicesEnabled: { type: "boolean" },
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

export const getCompanySettingsSchema = {
  tags: ["Settings"],
  summary: "Get company settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(CompanySettingsSchema, "Company settings"),
    ...ErrorResponses,
  },
} as const;

export const updateCompanySettingsSchema = {
  tags: ["Settings"],
  summary: "Update company settings",
  security: [{ bearerAuth: [] }],
  body: UpdateCompanySettingsBodySchema,
  response: {
    200: successEnvelope(CompanySettingsSchema, "Updated settings"),
    ...ErrorResponses,
  },
} as const;

export const getCurrencySettingsSchema = {
  tags: ["Settings"],
  summary: "Get currency settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(CurrencySettingsSchema, "Currency settings"),
    ...ErrorResponses,
  },
} as const;

export const getModuleSettingsSchema = {
  tags: ["Settings"],
  summary: "Get module settings",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(ModuleSettingsDataSchema, "Module settings"),
    ...ErrorResponses,
  },
} as const;

export const setupWizardSchema = {
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

export const getSettingByKeySchema = {
  tags: ["Settings"],
  summary: "Get setting by key",
  security: [{ bearerAuth: [] }],
  params: KeyParamsSchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Setting value"),
    ...ErrorResponses,
  },
} as const;

export const updateSettingByKeySchema = {
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
