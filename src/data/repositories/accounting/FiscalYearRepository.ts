import { eq, and, lte, gte, desc } from "drizzle-orm";
import type { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import {
  fiscalYears,
  type FiscalYearRow,
  type NewFiscalYearRow,
} from "../../schema/fiscal-years.js";

export class FiscalYearRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async findAll(): Promise<FiscalYearRow[]> {
    return this.db
      .select()
      .from(fiscalYears)
      .orderBy(desc(fiscalYears.startDate));
  }

  async findById(id: number): Promise<FiscalYearRow | null> {
    const [row] = await this.db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.id, id));
    return row ?? null;
  }

  async findActive(): Promise<FiscalYearRow | null> {
    const [row] = await this.db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.status, "OPEN"))
      .limit(1);
    return row ?? null;
  }

  async hasOverlap(
    startDate: string,
    endDate: string,
    excludeId?: number,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: fiscalYears.id })
      .from(fiscalYears)
      .where(
        and(
          lte(fiscalYears.startDate, endDate),
          gte(fiscalYears.endDate, startDate),
        ),
      );
    return rows.some((r) => r.id !== excludeId);
  }

  async create(data: NewFiscalYearRow): Promise<FiscalYearRow> {
    const [row] = await this.db
      .insert(fiscalYears)
      .values(data)
      .returning();
    return row;
  }

  async update(
    id: number,
    data: Partial<NewFiscalYearRow>,
    tx?: TxOrDb,
  ): Promise<FiscalYearRow> {
    const [row] = await this.c(tx)
      .update(fiscalYears)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fiscalYears.id, id))
      .returning();
    return row;
  }
}
