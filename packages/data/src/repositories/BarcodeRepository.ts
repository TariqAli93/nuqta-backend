import { eq, count as countFn, sql } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { barcodeTemplates, barcodePrintJobs } from "../schema/schema.js";
import {
  IBarcodeRepository,
  BarcodeTemplate,
  BarcodePrintJob,
} from "@nuqta/core";

export class BarcodeRepository implements IBarcodeRepository {
  constructor(private db: DbConnection) {}

  // ── Templates ─────────────────────────────────────────────────

  async findAllTemplates(): Promise<BarcodeTemplate[]> {
    const rows = await this.db.select().from(barcodeTemplates);
    return rows as unknown as BarcodeTemplate[];
  }

  async createTemplate(
    template: Partial<BarcodeTemplate>,
  ): Promise<BarcodeTemplate> {
    const [created] = await this.db
      .insert(barcodeTemplates)
      .values(template as any)
      .returning();
    return created as unknown as BarcodeTemplate;
  }

  async updateTemplate(
    id: number,
    template: Partial<BarcodeTemplate>,
  ): Promise<BarcodeTemplate> {
    const [updated] = await this.db
      .update(barcodeTemplates)
      .set(template as any)
      .where(eq(barcodeTemplates.id, id))
      .returning();
    return updated as unknown as BarcodeTemplate;
  }

  async deleteTemplate(id: number): Promise<void> {
    await this.db.delete(barcodeTemplates).where(eq(barcodeTemplates.id, id));
  }

  async getTemplateById(id: number): Promise<BarcodeTemplate | null> {
    const [row] = await this.db
      .select()
      .from(barcodeTemplates)
      .where(eq(barcodeTemplates.id, id));
    return (row as unknown as BarcodeTemplate) || null;
  }

  // ── Print Jobs ────────────────────────────────────────────────

  async findPrintJobs(params?: {
    productId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BarcodePrintJob[]; total: number }> {
    const conditions: any[] = [];
    if (params?.productId) {
      conditions.push(eq(barcodePrintJobs.productId, params.productId));
    }
    if (params?.status) {
      conditions.push(eq(barcodePrintJobs.status, params.status));
    }

    const where =
      conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : sql`${conditions[0]} AND ${conditions[1]}`
        : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(barcodePrintJobs)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db.select().from(barcodePrintJobs).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const items = await query;
    return { items: items as unknown as BarcodePrintJob[], total };
  }

  async createPrintJob(
    job: Partial<BarcodePrintJob>,
  ): Promise<BarcodePrintJob> {
    const [created] = await this.db
      .insert(barcodePrintJobs)
      .values(job as any)
      .returning();
    return created as unknown as BarcodePrintJob;
  }

  async updatePrintJobStatus(
    id: number,
    status: string,
    error?: string,
  ): Promise<void> {
    const data: any = { status };
    if (status === "printed") data.printedAt = new Date();
    if (error) data.printError = error;

    await this.db
      .update(barcodePrintJobs)
      .set(data)
      .where(eq(barcodePrintJobs.id, id));
  }

  async getPrintJobById(id: number): Promise<BarcodePrintJob | null> {
    const [row] = await this.db
      .select()
      .from(barcodePrintJobs)
      .where(eq(barcodePrintJobs.id, id));
    return (row as unknown as BarcodePrintJob) || null;
  }
}
