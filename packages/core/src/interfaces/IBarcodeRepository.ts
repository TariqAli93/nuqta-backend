import { BarcodeTemplate, BarcodePrintJob } from "../entities/Barcode.js";

export interface IBarcodeRepository {
  // Templates
  findAllTemplates(): Promise<BarcodeTemplate[]>;
  createTemplate(template: Partial<BarcodeTemplate>): Promise<BarcodeTemplate>;
  updateTemplate(
    id: number,
    template: Partial<BarcodeTemplate>,
  ): Promise<BarcodeTemplate>;
  deleteTemplate(id: number): Promise<void>;
  getTemplateById(id: number): Promise<BarcodeTemplate | null>;

  // Print Jobs
  findPrintJobs(params?: {
    productId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BarcodePrintJob[]; total: number }>;
  createPrintJob(job: Partial<BarcodePrintJob>): Promise<BarcodePrintJob>;
  updatePrintJobStatus(
    id: number,
    status: string,
    error?: string,
  ): Promise<void>;
  getPrintJobById(id: number): Promise<BarcodePrintJob | null>;
}
