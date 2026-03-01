import { FastifyPluginAsync } from "fastify";
import {
  PostPeriodUseCase,
  ReverseEntryUseCase,
  PostIndividualEntryUseCase,
  UnpostIndividualEntryUseCase,
} from "@nuqta/core";
import {
  postPeriodSchema,
  reverseEntrySchema,
  postEntrySchema,
  unpostEntrySchema,
} from "../../../schemas/posting.js";

const posting: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /posting/period
  fastify.post("/period", { schema: postPeriodSchema }, async (request) => {
    const body = request.body as {
      periodType: "day" | "month" | "year";
      periodStart: string;
      periodEnd: string;
      notes?: string;
    };
    const userId = request.user?.sub || 1;
    const uc = new PostPeriodUseCase(
      fastify.repos.posting,
      fastify.repos.settings,
    );
    const data = await uc.execute(body, userId);
    return { ok: true, data };
  });

  // POST /posting/entries/:id/reverse
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/reverse",
    { schema: reverseEntrySchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new ReverseEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/entries/:id/post
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/post",
    { schema: postEntrySchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new PostIndividualEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/entries/:id/unpost
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/unpost",
    { schema: unpostEntrySchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new UnpostIndividualEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );
};

export default posting;
