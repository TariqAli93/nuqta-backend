import { FastifyPluginAsync } from "fastify";
import {
  GetSuppliersUseCase,
  GetSupplierByIdUseCase,
  CreateSupplierUseCase,
  UpdateSupplierUseCase,
  DeleteSupplierUseCase,
  type Supplier,
} from "@nuqta/core";

const suppliers: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /suppliers
  fastify.get("/", async (request) => {
    const query = request.query as {
      search?: string;
      limit?: string;
      offset?: string;
    };
    const uc = new GetSuppliersUseCase(fastify.repos.supplier);
    const data = await uc.execute({
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return { ok: true, data };
  });

  // GET /suppliers/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request) => {
    const id = parseInt(request.params.id, 10);
    const uc = new GetSupplierByIdUseCase(fastify.repos.supplier);
    const data = await uc.execute(id);
    return { ok: true, data };
  });

  // POST /suppliers
  fastify.post("/", async (request) => {
    const body = request.body as Supplier;
    const uc = new CreateSupplierUseCase(fastify.repos.supplier);
    const data = await uc.execute(body);
    return { ok: true, data };
  });

  // PUT /suppliers/:id
  fastify.put<{ Params: { id: string } }>("/:id", async (request) => {
    const id = parseInt(request.params.id, 10);
    const body = request.body as Partial<Supplier>;
    const uc = new UpdateSupplierUseCase(fastify.repos.supplier);
    const data = await uc.execute(id, body);
    return { ok: true, data };
  });

  // DELETE /suppliers/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const id = parseInt(request.params.id, 10);
    const uc = new DeleteSupplierUseCase(fastify.repos.supplier);
    await uc.execute(id);
    return { ok: true, data: null };
  });
};

export default suppliers;
