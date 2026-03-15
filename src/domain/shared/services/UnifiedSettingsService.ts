import type { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import type { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import type { IPosSettingsRepository } from "../../interfaces/IPosSettingsRepository.js";
import type { IBarcodeSettingsRepository } from "../../interfaces/IBarcodeSettingsRepository.js";
import type { ISystemSettingsRepository } from "../../interfaces/ISystemSettingsRepository.js";

export class UnifiedSettingsService {
  constructor(
    private kvSettings: ISettingsRepository,
    private accountingSettings: IAccountingSettingsRepository,
    private posSettings: IPosSettingsRepository,
    private barcodeSettings: IBarcodeSettingsRepository,
    private systemSettings: ISystemSettingsRepository,
  ) {}

  getAccounting() {
    return this.accountingSettings.get();
  }
  updateAccounting(data: Parameters<IAccountingSettingsRepository["update"]>[0]) {
    return this.accountingSettings.update(data);
  }
  getPos() {
    return this.posSettings.get();
  }
  updatePos(data: Parameters<IPosSettingsRepository["update"]>[0]) {
    return this.posSettings.update(data);
  }
  getBarcode() {
    return this.barcodeSettings.get();
  }
  updateBarcode(data: Parameters<IBarcodeSettingsRepository["update"]>[0]) {
    return this.barcodeSettings.update(data);
  }
  getSystem() {
    return this.systemSettings.get();
  }
  updateSystem(data: Parameters<ISystemSettingsRepository["update"]>[0]) {
    return this.systemSettings.update(data);
  }
  getValue(key: string) {
    return this.kvSettings.get(key);
  }
  setValue(key: string, v: string) {
    return this.kvSettings.set(key, v);
  }
  getCompany() {
    return this.kvSettings.getCompanySettings();
  }
  setCompany(data: Parameters<ISettingsRepository["setCompanySettings"]>[0]) {
    return this.kvSettings.setCompanySettings(data);
  }
  getCurrency() {
    return this.kvSettings.getCurrencySettings();
  }
  getAll() {
    return this.kvSettings.getAll();
  }
}
