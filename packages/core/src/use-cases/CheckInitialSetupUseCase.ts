import { IUserRepository } from "../interfaces/IUserRepository.js";
import { ISettingsRepository } from "../interfaces/ISettingsRepository.js";

export interface SetupStatus {
  isInitialized: boolean;
  hasUsers: boolean;
  hasCompanyInfo: boolean;
  wizardCompleted: boolean;
}

export class CheckInitialSetupUseCase {
  constructor(
    private userRepo: IUserRepository,
    private settingsRepo: ISettingsRepository,
  ) {}

  async execute(): Promise<SetupStatus> {
    // Primary flag — set atomically at the end of InitializeAppUseCase
    const initialized = await this.settingsRepo.get("app_initialized");
    const isInitialized = initialized === "true";
    const wizardFlag1 = await this.settingsRepo.get("setup.wizardCompleted");
    const wizardFlag2 = await this.settingsRepo.get("setup.wizard_completed");
    const wizardFlag = wizardFlag1 ?? wizardFlag2;
    const wizardCompleted =
      wizardFlag === null ? isInitialized : wizardFlag === "true";

    // Fallback checks for partial-setup detection
    const userCount = await this.userRepo.count();
    const companySettings = {
      name: await this.settingsRepo.get("company_name"),
      city: await this.settingsRepo.get("company_city"),
      area: await this.settingsRepo.get("company_area"),
      street: await this.settingsRepo.get("company_street"),
    } as const;

    const hasUsers = userCount > 0;
    const hasCompanyInfo =
      !!companySettings.name ||
      !!companySettings.city ||
      !!companySettings.area ||
      !!companySettings.street;

    return {
      isInitialized,
      hasUsers,
      hasCompanyInfo,
      wizardCompleted,
    };
  }
}
