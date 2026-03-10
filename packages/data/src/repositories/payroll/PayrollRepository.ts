import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreatePayrollRunRecord,
  IPayrollRepository,
  PayrollRun,
  PayrollRunItem,
} from "@nuqta/core";
import { DbConnection } from "../../db/db.js";
import { payrollRunItems, payrollRuns } from "../../schema/schema.js";

export class PayrollRepository implements IPayrollRepository {
  constructor(private db: DbConnection) {}

  async findAll(params?: {
    status?: "draft" | "approved";
    periodYear?: number;
    periodMonth?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PayrollRun[]; total: number }> {
    const conditions: any[] = [];
    if (params?.status) {
      conditions.push(eq(payrollRuns.status, params.status));
    }
    if (params?.periodYear !== undefined) {
      conditions.push(eq(payrollRuns.periodYear, params.periodYear));
    }
    if (params?.periodMonth !== undefined) {
      conditions.push(eq(payrollRuns.periodMonth, params.periodMonth));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(payrollRuns)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(payrollRuns)
      .where(where)
      .orderBy(desc(payrollRuns.periodYear), desc(payrollRuns.periodMonth))
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as PayrollRun[], total };
  }

  async findById(id: number): Promise<PayrollRun | null> {
    const [row] = await this.db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, id));
    if (!row) return null;

    const items = await this.db
      .select()
      .from(payrollRunItems)
      .where(eq(payrollRunItems.payrollRunId, id));

    return {
      ...(row as PayrollRun),
      items: items as PayrollRunItem[],
    };
  }

  async existsForPeriod(
    periodYear: number,
    periodMonth: number,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.periodYear, periodYear),
          eq(payrollRuns.periodMonth, periodMonth),
        ),
      );

    return Number(row?.count ?? 0) > 0;
  }

  async create(run: CreatePayrollRunRecord): Promise<PayrollRun> {
    const { items, ...runData } = run;

    const [createdRun] = await this.db
      .insert(payrollRuns)
      .values(runData as any)
      .returning();

    if (items.length > 0) {
      await this.db.insert(payrollRunItems).values(
        items.map((item: CreatePayrollRunRecord["items"][number]) => ({
          ...item,
          payrollRunId: createdRun.id,
        })) as any,
      );
    }

    return (await this.findById(createdRun.id)) as PayrollRun;
  }

  async approve(
    id: number,
    input: {
      journalEntryId: number;
      approvedBy: number;
      approvedAt?: Date | string;
    },
  ): Promise<PayrollRun> {
    await this.db
      .update(payrollRuns)
      .set({
        status: "approved",
        journalEntryId: input.journalEntryId,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt || new Date(),
      } as any)
      .where(eq(payrollRuns.id, id));

    return (await this.findById(id)) as PayrollRun;
  }
}
