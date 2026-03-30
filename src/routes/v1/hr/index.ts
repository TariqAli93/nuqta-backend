import { FastifyPluginAsync } from "fastify";
import {
  ApprovePayrollRunUseCase,
  CancelPayrollUseCase,
  CreateDepartmentUseCase,
  CreateEmployeeUseCase,
  CreatePayrollRunUseCase,
  DisbursePayrollUseCase,
  GetDepartmentByIdUseCase,
  GetEmployeeByIdUseCase,
  GetPayrollRunByIdUseCase,
  SubmitPayrollUseCase,
  UpdateDepartmentUseCase,
  UpdateEmployeeUseCase,
  type Department,
  type Employee,
  type CreatePayrollRunInput,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const EmployeeSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    salary: { type: "integer" },
    position: { type: "string" },
    departmentId: { type: "integer" },
    departmentName: { type: "string", nullable: true },
    department: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const EmployeeListSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: EmployeeSchema,
    },
    total: { type: "integer" },
  },
};

const DepartmentSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const DepartmentListSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: DepartmentSchema,
    },
    total: { type: "integer" },
  },
};

const PayrollRunItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    payrollRunId: { type: "integer" },
    employeeId: { type: "integer" },
    employeeName: { type: "string" },
    position: { type: "string" },
    departmentName: { type: "string" },
    department: { type: "string", nullable: true },
    grossPay: { type: "integer" },
    deductions: { type: "integer" },
    bonuses: { type: "integer" },
    netPay: { type: "integer" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const PayrollRunSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    periodYear: { type: "integer" },
    periodMonth: { type: "integer" },
    paymentDate: { type: "string", nullable: true, format: "date-time" },
    status: {
      type: "string",
      enum: ["draft", "submitted", "approved", "disbursed", "cancelled"],
    },
    totalGrossPay: { type: "integer" },
    totalDeductions: { type: "integer" },
    totalBonuses: { type: "integer" },
    totalNetPay: { type: "integer" },
    salaryExpenseAccountCode: { type: "string" },
    deductionsLiabilityAccountCode: { type: "string" },
    paymentAccountCode: { type: "string" },
    journalEntryId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    approvedAt: { type: "string", nullable: true, format: "date-time" },
    approvedBy: { type: "integer", nullable: true },
    items: {
      type: "array" as const,
      items: PayrollRunItemSchema,
    },
  },
};

const PayrollRunListSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: PayrollRunSchema,
    },
    total: { type: "integer" },
  },
};

const EmployeeListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by employee name" },
    departmentId: { type: "string", pattern: "^\\d+$", description: "Filter by department ID" },
    department: { type: "string", description: "Legacy filter by department name" },
    isActive: { type: "string", enum: ["true", "false"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const CreateEmployeeBodySchema = {
  type: "object" as const,
  required: ["name", "salary", "position"],
  properties: {
    name: { type: "string", minLength: 1 },
    salary: { type: "integer", minimum: 0 },
    position: { type: "string", minLength: 1 },
    departmentId: { type: "integer", minimum: 1 },
    department: { type: "string", minLength: 1 },
    isActive: { type: "boolean", default: true },
  },
  anyOf: [{ required: ["departmentId"] }, { required: ["department"] }],
  additionalProperties: false,
} as const;

const UpdateEmployeeBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    salary: { type: "integer", minimum: 0 },
    position: { type: "string", minLength: 1 },
    departmentId: { type: "integer", minimum: 1 },
    department: { type: "string", minLength: 1 },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const DepartmentListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by department name" },
    isActive: { type: "string", enum: ["true", "false"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const CreateDepartmentBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateDepartmentBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const PayrollRunListQuerySchema = {
  type: "object" as const,
  properties: {
    status: {
      type: "string",
      enum: ["draft", "submitted", "approved", "disbursed", "cancelled"],
    },
    periodYear: { type: "string", pattern: "^\\d{4}$" },
    periodMonth: { type: "string", pattern: "^(0?[1-9]|1[0-2])$" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const CreatePayrollRunBodySchema = {
  type: "object" as const,
  required: ["periodYear", "periodMonth", "items"],
  properties: {
    periodYear: { type: "integer", minimum: 2000 },
    periodMonth: { type: "integer", minimum: 1, maximum: 12 },
    paymentDate: { type: "string", format: "date" },
    salaryExpenseAccountCode: {
      type: "string",
      description: "Defaults to accounting.salaryExpenseAccountCode or 5002",
    },
    deductionsLiabilityAccountCode: {
      type: "string",
      description:
        "Defaults to accounting.deductionsLiabilityAccountCode or 2101",
    },
    paymentAccountCode: {
      type: "string",
      description: "Defaults to accounting.cashAccountCode or 1001",
    },
    notes: { type: "string" },
    items: {
      type: "array" as const,
      minItems: 1,
      items: {
        type: "object" as const,
        required: ["employeeId"],
        properties: {
          employeeId: { type: "integer", minimum: 1 },
          deductions: { type: "integer", minimum: 0, default: 0 },
          bonuses: { type: "integer", minimum: 0, default: 0 },
          notes: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

const getEmployeesSchema = {
  tags: ["HR & Payroll"],
  summary: "List employees",
  security: [{ bearerAuth: [] }],
  querystring: EmployeeListQuerySchema,
  response: {
    200: successEnvelope(EmployeeListSchema, "Employees"),
    ...ErrorResponses,
  },
} as const;

const getEmployeeByIdSchema = {
  tags: ["HR & Payroll"],
  summary: "Get employee by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(EmployeeSchema, "Employee"),
    ...ErrorResponses,
  },
} as const;

const createEmployeeSchema = {
  tags: ["HR & Payroll"],
  summary: "Create employee",
  security: [{ bearerAuth: [] }],
  body: CreateEmployeeBodySchema,
  response: {
    200: successEnvelope(EmployeeSchema, "Created employee"),
    ...ErrorResponses,
  },
} as const;

const updateEmployeeSchema = {
  tags: ["HR & Payroll"],
  summary: "Update employee",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateEmployeeBodySchema,
  response: {
    200: successEnvelope(EmployeeSchema, "Updated employee"),
    ...ErrorResponses,
  },
} as const;

const getDepartmentsSchema = {
  tags: ["HR & Payroll"],
  summary: "List departments",
  security: [{ bearerAuth: [] }],
  querystring: DepartmentListQuerySchema,
  response: {
    200: successEnvelope(DepartmentListSchema, "Departments"),
    ...ErrorResponses,
  },
} as const;

const getDepartmentByIdSchema = {
  tags: ["HR & Payroll"],
  summary: "Get department by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(DepartmentSchema, "Department"),
    ...ErrorResponses,
  },
} as const;

const createDepartmentSchema = {
  tags: ["HR & Payroll"],
  summary: "Create department",
  security: [{ bearerAuth: [] }],
  body: CreateDepartmentBodySchema,
  response: {
    200: successEnvelope(DepartmentSchema, "Created department"),
    ...ErrorResponses,
  },
} as const;

const updateDepartmentSchema = {
  tags: ["HR & Payroll"],
  summary: "Update department",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateDepartmentBodySchema,
  response: {
    200: successEnvelope(DepartmentSchema, "Updated department"),
    ...ErrorResponses,
  },
} as const;

const getPayrollRunsSchema = {
  tags: ["HR & Payroll"],
  summary: "List payroll runs",
  security: [{ bearerAuth: [] }],
  querystring: PayrollRunListQuerySchema,
  response: {
    200: successEnvelope(PayrollRunListSchema, "Payroll runs"),
    ...ErrorResponses,
  },
} as const;

const getPayrollRunByIdSchema = {
  tags: ["HR & Payroll"],
  summary: "Get payroll run by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(PayrollRunSchema, "Payroll run"),
    ...ErrorResponses,
  },
} as const;

const createPayrollRunSchema = {
  tags: ["HR & Payroll"],
  summary: "Create payroll run",
  description:
    "Calculates each employee net pay as Gross - Deductions + Bonuses and saves a draft payroll run.",
  security: [{ bearerAuth: [] }],
  body: CreatePayrollRunBodySchema,
  response: {
    200: successEnvelope(PayrollRunSchema, "Created payroll run"),
    ...ErrorResponses,
  },
} as const;

const approvePayrollRunSchema = {
  tags: ["HR & Payroll"],
  summary: "Approve payroll run",
  description:
    "Approves the payroll run and creates a manual-source journal entry that debits salary expense, credits cash/bank for net pay, and credits payroll deductions payable when deductions exist.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      PayrollRunSchema,
      "Approved payroll run with accounting journal entry",
    ),
    ...ErrorResponses,
  },
} as const;

const resolveDepartmentId = async (
  fastify: Parameters<FastifyPluginAsync>[0],
  input: { departmentId?: number; department?: string },
): Promise<number | undefined> => {
  if (Number.isInteger(input.departmentId) && (input.departmentId ?? 0) > 0) {
    return input.departmentId;
  }

  const legacyDepartmentName = input.department?.trim();
  if (!legacyDepartmentName) {
    return undefined;
  }

  const departmentRepo = (fastify as any).repos?.department;
  if (!departmentRepo || typeof departmentRepo.findAll !== "function") {
    return 1;
  }

  const { items } = await departmentRepo.findAll({
    search: legacyDepartmentName,
    limit: 50,
    offset: 0,
  });

  const match = items.find(
    (department: Department) =>
      department.name.trim().toLowerCase() === legacyDepartmentName.toLowerCase(),
  );

  return match?.id;
};

const mapEmployeeResponse = <T extends Record<string, unknown>>(employee: T): T => ({
  ...employee,
  department:
    (employee.department as string | undefined) ??
    (employee.departmentName as string | undefined) ??
    null,
});

const mapPayrollRunResponse = <T extends Record<string, unknown>>(payrollRun: T): T => ({
  ...payrollRun,
  items: Array.isArray(payrollRun.items)
    ? payrollRun.items.map((item) => ({
        ...(item as Record<string, unknown>),
        department:
          (item as { department?: string }).department ??
          (item as { departmentName?: string }).departmentName ??
          null,
      }))
    : payrollRun.items,
});

const hr: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get(
    "/employees",
    {
      schema: getEmployeesSchema,
      preHandler: requirePermission("hr:read"),
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        departmentId?: string;
        department?: string;
        isActive?: string;
        limit?: string;
        offset?: string;
      };
      const departmentId = await resolveDepartmentId(fastify, {
        departmentId: query.departmentId
          ? parseInt(query.departmentId, 10)
          : undefined,
        department: query.department,
      });

      if (query.department && !departmentId) {
        return { ok: true, data: { items: [], total: 0 } };
      }

      const data = await fastify.repos.employee.findAll({
        search: query.search,
        departmentId,
        isActive:
          query.isActive !== undefined ? query.isActive === "true" : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return {
        ok: true,
        data: {
          ...data,
          items: data.items.map((item) => mapEmployeeResponse(item as any)),
        },
      };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/employees/:id",
    {
      schema: getEmployeeByIdSchema,
      preHandler: requirePermission("hr:read"),
    },
    async (request) => {
      const uc = new GetEmployeeByIdUseCase(fastify.repos.employee);
      const data = await uc.execute(parseInt(request.params.id, 10));
      return { ok: true, data: mapEmployeeResponse(data as any) };
    },
  );

  fastify.post(
    "/employees",
    {
      schema: createEmployeeSchema,
      preHandler: requirePermission("hr:update"),
    },
    async (request) => {
      const body = request.body as Employee & { department?: string };
      const departmentId = await resolveDepartmentId(fastify, {
        departmentId: body.departmentId,
        department: body.department,
      });

      if (!departmentId) {
        throw fastify.httpErrors.badRequest("Employee departmentId is required");
      }

      const uc = new CreateEmployeeUseCase(fastify.repos.employee);
      const data = await uc.execute(
        { ...body, departmentId } as Employee,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data: mapEmployeeResponse(data as any) };
    },
  );

  fastify.put<{ Params: { id: string } }>(
    "/employees/:id",
    {
      schema: updateEmployeeSchema,
      preHandler: requirePermission("hr:update"),
    },
    async (request) => {
      const body = request.body as Partial<Employee> & { department?: string };
      const resolvedDepartmentId =
        body.departmentId !== undefined || body.department !== undefined
          ? await resolveDepartmentId(fastify, {
              departmentId: body.departmentId,
              department: body.department,
            })
          : undefined;

      if ((body.departmentId !== undefined || body.department !== undefined) && !resolvedDepartmentId) {
        throw fastify.httpErrors.badRequest("Employee departmentId is required");
      }

      const uc = new UpdateEmployeeUseCase(fastify.repos.employee);
      const data = await uc.execute(
        {
          id: parseInt(request.params.id, 10),
          employee: {
            ...body,
            ...(resolvedDepartmentId !== undefined
              ? { departmentId: resolvedDepartmentId }
              : {}),
          },
        },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data: mapEmployeeResponse(data as any) };
    },
  );

  // ── Departments ─────────────────────────────────────────────

  fastify.get(
    "/departments",
    {
      schema: getDepartmentsSchema,
      preHandler: requirePermission("hr:read"),
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        isActive?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.department.findAll({
        search: query.search,
        isActive:
          query.isActive !== undefined ? query.isActive === "true" : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/departments/:id",
    {
      schema: getDepartmentByIdSchema,
      preHandler: requirePermission("hr:read"),
    },
    async (request) => {
      const uc = new GetDepartmentByIdUseCase(fastify.repos.department);
      const data = await uc.execute(parseInt(request.params.id, 10));
      return { ok: true, data };
    },
  );

  fastify.post(
    "/departments",
    {
      schema: createDepartmentSchema,
      preHandler: requirePermission("hr:update"),
    },
    async (request) => {
      const body = request.body as Department;
      const uc = new CreateDepartmentUseCase(fastify.repos.department);
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  fastify.put<{ Params: { id: string } }>(
    "/departments/:id",
    {
      schema: updateDepartmentSchema,
      preHandler: requirePermission("hr:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<Department>;
      const uc = new UpdateDepartmentUseCase(fastify.repos.department);
      const data = await uc.execute(
        { id, department: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // ── Payroll ─────────────────────────────────────────────────

  fastify.get(
    "/payroll-runs",
    {
      schema: getPayrollRunsSchema,
      preHandler: requirePermission("payroll:read"),
    },
    async (request) => {
      const query = request.query as {
        status?: "draft" | "approved";
        periodYear?: string;
        periodMonth?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.payroll.findAll({
        status: query.status,
        periodYear: query.periodYear
          ? parseInt(query.periodYear, 10)
          : undefined,
        periodMonth: query.periodMonth
          ? parseInt(query.periodMonth, 10)
          : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return {
        ok: true,
        data: {
          ...data,
          items: data.items.map((item) => mapPayrollRunResponse(item as any)),
        },
      };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/payroll-runs/:id",
    {
      schema: getPayrollRunByIdSchema,
      preHandler: requirePermission("payroll:read"),
    },
    async (request) => {
      const uc = new GetPayrollRunByIdUseCase(fastify.repos.payroll);
      const data = await uc.execute(parseInt(request.params.id, 10));
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );

  fastify.post(
    "/payroll-runs",
    {
      schema: createPayrollRunSchema,
      preHandler: requirePermission("payroll:update"),
    },
    async (request) => {
      const body = request.body as CreatePayrollRunInput;
      const userId = (request.user?.sub ?? "system") as any;
      const uc = new CreatePayrollRunUseCase(
        fastify.repos.employee,
        fastify.repos.payroll,
        fastify.repos.settings,
      );
      const data = await uc.execute(body, userId);
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/payroll-runs/:id/approve",
    {
      schema: approvePayrollRunSchema,
      preHandler: requirePermission("payroll:approve"),
    },
    async (request) => {
      const userId = String(request.user?.sub ?? "system");
      const uc = new ApprovePayrollRunUseCase(
        fastify.repos.payroll,
        fastify.repos.accounting,
      );
      const data = await uc.execute(parseInt(request.params.id, 10), userId);
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/payroll-runs/:id/submit",
    {
      schema: {
        tags: ["HR & Payroll"],
        summary: "Submit payroll run for approval",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(PayrollRunSchema, "Submitted payroll run"),
          ...ErrorResponses,
        },
      },
      preHandler: requirePermission("payroll:update"),
    },
    async (request) => {
      const userId = String(request.user?.sub ?? 1);
      const uc = new SubmitPayrollUseCase(fastify.repos.payroll);
      const data = await uc.execute(
        { payrollRunId: parseInt(request.params.id, 10) },
        userId,
      );
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/payroll-runs/:id/disburse",
    {
      schema: {
        tags: ["HR & Payroll"],
        summary: "Mark payroll run as disbursed",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(PayrollRunSchema, "Disbursed payroll run"),
          ...ErrorResponses,
        },
      },
      preHandler: requirePermission("payroll:approve"),
    },
    async (request) => {
      const userId = String(request.user?.sub ?? 1);
      const uc = new DisbursePayrollUseCase(fastify.repos.payroll);
      const data = await uc.execute(
        { payrollRunId: parseInt(request.params.id, 10) },
        userId,
      );
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/payroll-runs/:id/cancel",
    {
      schema: {
        tags: ["HR & Payroll"],
        summary: "Cancel a payroll run",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(PayrollRunSchema, "Cancelled payroll run"),
          ...ErrorResponses,
        },
      },
      preHandler: requirePermission("payroll:approve"),
    },
    async (request) => {
      const userId = String(request.user?.sub ?? 1);
      const uc = new CancelPayrollUseCase(fastify.repos.payroll);
      const data = await uc.execute(
        { payrollRunId: parseInt(request.params.id, 10) },
        userId,
      );
      return { ok: true, data: mapPayrollRunResponse(data as any) };
    },
  );
};

export default hr;
