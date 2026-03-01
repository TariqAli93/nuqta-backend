import { FastifyPluginAsync } from "fastify";
import {
  GetSettingUseCase,
  SetSettingUseCase,
  GetCompanySettingsUseCase,
  SetCompanySettingsUseCase,
  GetCurrencySettingsUseCase,
  GetModuleSettingsUseCase,
  CompleteSetupWizardUseCase,
} from "@nuqta/core";
import {
  getCompanySettingsSchema,
  updateCompanySettingsSchema,
  getCurrencySettingsSchema,
  getModuleSettingsSchema,
  setupWizardSchema,
  getSettingByKeySchema,
  updateSettingByKeySchema,
} from "../../../schemas/settings.js";

const settings: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /settings/company
  fastify.get(
    "/company",
    { schema: getCompanySettingsSchema },
    async (request) => {
      const uc = new GetCompanySettingsUseCase(fastify.repos.settings);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // PUT /settings/company
  fastify.put(
    "/company",
    { schema: updateCompanySettingsSchema },
    async (request) => {
      const body = request.body as any;
      const uc = new SetCompanySettingsUseCase(fastify.repos.settings);
      await uc.execute(body);
      return { ok: true, data: body };
    },
  );

  // GET /settings/currency
  fastify.get(
    "/currency",
    { schema: getCurrencySettingsSchema },
    async (request) => {
      const uc = new GetCurrencySettingsUseCase(fastify.repos.settings);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // GET /settings/modules
  fastify.get(
    "/modules",
    { schema: getModuleSettingsSchema },
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
      uc.execute(body);
      return { ok: true, data: { completed: true } };
    },
  );

  // GET /settings/:key
  fastify.get<{ Params: { key: string } }>(
    "/:key",
    { schema: getSettingByKeySchema },
    async (request) => {
      const uc = new GetSettingUseCase(fastify.repos.settings);
      const data = await uc.execute(request.params.key);
      return { ok: true, data };
    },
  );

  // PUT /settings/:key
  fastify.put<{ Params: { key: string } }>(
    "/:key",
    { schema: updateSettingByKeySchema },
    async (request) => {
      const { value } = request.body as { value: string };
      const uc = new SetSettingUseCase(fastify.repos.settings);
      await uc.execute(request.params.key, value);
      return { ok: true, data: null };
    },
  );
};

export default settings;
