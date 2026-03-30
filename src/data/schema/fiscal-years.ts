import {
  pgTable,
  pgEnum,
  serial,
  text,
  date,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const fiscalYearStatusEnum = pgEnum("fiscal_year_status", [
  "OPEN",
  "CLOSED",
]);

export const fiscalYears = pgTable("fiscal_years", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: fiscalYearStatusEnum("status").notNull().default("OPEN"),
  notes: text("notes"),
  closedAt: timestamp("closed_at"),
  closedById: integer("closed_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FiscalYearRow = typeof fiscalYears.$inferSelect;
export type NewFiscalYearRow = typeof fiscalYears.$inferInsert;
