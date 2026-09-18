import { prisma } from '@hotel-pms/db';

export class GLMappingService {
  /**
   * Resolves the Asset/Clearing GL account ID for a given Payment Method.
   * Maps:
   * CASH -> 1000 Cash on Hand
   * CARD -> 1110 Credit Card Receivable
   * BANK_TRANSFER -> 1130 Bank Transfer Receivable
   * CHEQUE -> 1150 Cheques in Hand
   * ROOM_CHARGE -> 1100 Guest Ledger Receivable
   * CITY_LEDGER -> 1140 City Ledger Receivable
   */
  static async getAssetAccountForMethod(propertyId: string, method: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    if (!property) throw new Error('Property not found');

    const settings = (property.settings as any) || {};
    const assetMap = settings?.accountingConfig?.assetAccounts || {};

    // 1. Check if the property has explicitly overridden the GL mapping for this method
    let targetCode = assetMap[method];

    // 2. If no explicit override, use the standard USALI default mappings
    if (!targetCode) {
      switch (method) {
        case 'CASH':
          targetCode = '1000'; // Cash on Hand
          break;
        case 'CARD':
        case 'POS':
        case 'CARD_OFFLINE':
        case 'PAYMENT_GATEWAY':
          targetCode = '1110'; // Credit Card Receivable
          break;
        case 'BANK_TRANSFER':
          targetCode = '1130'; // Bank Transfer Receivable
          break;
        case 'CHEQUE':
          targetCode = '1150'; // Cheques in Hand
          break;
        case 'MOBILE_PAYMENT':
          targetCode = '1135'; // Mobile Money Receivable
          break;
        case 'ROOM_CHARGE':
          targetCode = '1100'; // Guest Ledger
          break;
        case 'CITY_LEDGER':
          targetCode = '1140'; // City Ledger
          break;
        case 'COMPLIMENTARY':
          // For POS orders settled as COMPLIMENTARY, we debit the contra-revenue allowance account
          const compCode = (property.settings as any)?.accountingConfig?.contraRevenueAccounts?.COMPLIMENTARY;
          targetCode = compCode || '4900'; // 4900 is 'Revenue Rebates and Discounts' in the current DB schema
          break;
        default:
          throw new Error(`Cannot resolve automatic GL mapping for payment method: ${method}`);
      }
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: targetCode, isActive: true }
    });

    if (!account) {
      throw new Error(`Required GL Account Code ${targetCode} is missing or inactive for this property.`);
    }

    return account.id;
  }

  /**
   * Resolves the Guest Ledger Receivable account (1100).
   * Used for crediting during folio payments.
   */
  static async getGuestLedgerAccount(propertyId: string): Promise<string> {
    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: '1100', isActive: true }
    });
    if (!account) {
      throw new Error(`Guest Ledger GL Account (1100) is missing for this property.`);
    }
    return account.id;
  }

  /** Resolves the city-ledger AR control account (1140). */
  static async getCityLedgerAccount(propertyId: string): Promise<string> {
    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: '1140', isActive: true }
    });
    if (!account) {
      throw new Error(`City Ledger Receivable GL Account (1140) is missing for this property.`);
    }
    return account.id;
  }

  /** Resolves the liability used for guest credits transferred for refund. */
  static async getGuestRefundsPayableAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    const settings = (property.settings as Record<string, unknown>) || {};
    const accountingConfig = (settings.accountingConfig as Record<string, unknown>) || {};
    const liabilityAccounts = (accountingConfig.liabilityAccounts as Record<string, unknown>) || {};
    const targetCode = typeof liabilityAccounts.GUEST_REFUNDS === 'string' ? liabilityAccounts.GUEST_REFUNDS : '2160';
    const account = await prisma.chartOfAccount.findFirst({ where: { propertyId, code: targetCode, type: 'LIABILITY', isActive: true } });
    if (!account) throw new Error(`Guest Refunds Payable GL Account Code ${targetCode} is missing or inactive for this property.`);
    return account.id;
  }

  /** Resolves the liability used for unapplied corporate receipts. */
  static async getCorporateAdvancesAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    const settings = (property.settings as Record<string, unknown>) || {};
    const accountingConfig = (settings.accountingConfig as Record<string, unknown>) || {};
    const liabilityAccounts = (accountingConfig.liabilityAccounts as Record<string, unknown>) || {};
    const targetCode = typeof liabilityAccounts.CORPORATE_ADVANCES === 'string'
      ? liabilityAccounts.CORPORATE_ADVANCES
      : '2300';
    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: targetCode, type: 'LIABILITY', isActive: true },
    });
    if (!account) throw new Error(`Corporate Advances GL Account Code ${targetCode} is missing or inactive for this property.`);
    return account.id;
  }

  /**
   * Resolves the Revenue GL Account dynamically based on FnbClass.
   * Do not guess or fallback to wildcards.
   */
  static async getPosRevenueAccount(propertyId: string, fnbClass: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    if (!property) throw new Error('Property not found');

    const settings = (property.settings as any) || {};
    const revenueMap = settings?.accountingConfig?.revenueAccounts || {};

    const configuredCode = revenueMap[fnbClass];

    if (!configuredCode) {
      throw new Error(`F&B revenue GL mapping required for class: ${fnbClass}. Please configure Property Settings (accountingConfig.revenueAccounts).`);
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`Configured Revenue GL Account Code ${configuredCode} for ${fnbClass} is missing or inactive for this property.`);
    }

    return account.id;
  }

  /**
   * Resolves the Laundry Revenue GL Account.
   * Reads from accountingConfig.revenueAccounts.LAUNDRY, default seeded to 4300.
   */
  static async getLaundryRevenueAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    if (!property) throw new Error('Property not found');

    const settings = (property.settings as any) || {};
    const revenueMap = settings?.accountingConfig?.revenueAccounts || {};

    const configuredCode = revenueMap['LAUNDRY'];

    if (!configuredCode) {
      throw new Error(`Laundry revenue GL mapping required. Please configure Property Settings (accountingConfig.revenueAccounts.LAUNDRY).`);
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`Configured Laundry Revenue GL Account Code ${configuredCode} is missing or inactive for this property.`);
    }

    return account.id;
  }

  /** Resolves the configured fallback revenue account for manually issued AR invoices. */
  static async getOtherRevenueAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    const settings = (property.settings as Record<string, unknown>) || {};
    const accountingConfig = (settings.accountingConfig as Record<string, unknown>) || {};
    const revenueAccounts = (accountingConfig.revenueAccounts as Record<string, unknown>) || {};
    const targetCode = typeof revenueAccounts.OTHER === 'string' ? revenueAccounts.OTHER : '4400';
    const account = await prisma.chartOfAccount.findFirst({ where: { propertyId, code: targetCode, type: 'REVENUE', isActive: true } });
    if (!account) throw new Error(`Other operating revenue GL Account Code ${targetCode} is missing or inactive for this property.`);
    return account.id;
  }

  /**
   * Resolves the Discount Allowance (Contra-Revenue) GL Account.
   * Reads from accountingConfig.contraRevenueAccounts.DISCOUNT.
   */
  static async getDiscountAllowanceAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    const settings = (property?.settings as any) || {};
    const contraMap = settings?.accountingConfig?.contraRevenueAccounts || {};
    const configuredCode = contraMap['DISCOUNT'];

    if (!configuredCode) {
      throw new Error(`Discount allowance GL mapping required. Please configure Property Settings (accountingConfig.contraRevenueAccounts.DISCOUNT).`);
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`GL Account Code ${configuredCode} is missing or inactive for property ${propertyId}.`);
    }

    return account.id;
  }

  /**
   * Resolves the Complimentary Allowance (Contra-Revenue) GL Account.
   * Reads from accountingConfig.contraRevenueAccounts.COMPLIMENTARY.
   */
  static async getComplimentaryAllowanceAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    const settings = (property?.settings as any) || {};
    const contraMap = settings?.accountingConfig?.contraRevenueAccounts || {};
    const configuredCode = contraMap['COMPLIMENTARY'];

    if (!configuredCode) {
      throw new Error(`Complimentary allowance GL mapping required. Please configure Property Settings (accountingConfig.contraRevenueAccounts.COMPLIMENTARY).`);
    }

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`GL Account Code ${configuredCode} is missing or inactive for property ${propertyId}.`);
    }

    return account.id;
  }

  /**
   * Resolves the Tax Payable (Liability) GL Account.
   * Reads from accountingConfig.liabilityAccounts.TAX (defaulting to 2200).
   */
  static async getTaxPayableAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    const settings = (property?.settings as any) || {};
    const liabilityMap = settings?.accountingConfig?.liabilityAccounts || {};
    const configuredCode = liabilityMap['TAX'] || '2200';

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`Tax Liability GL Account Code ${configuredCode} is missing or inactive for property ${propertyId}.`);
    }

    return account.id;
  }

  /**
   * Resolves the Service Charge Payable (Liability) GL Account.
   * Reads from accountingConfig.liabilityAccounts.SERVICE_CHARGE (defaulting to 2210).
   */
  static async getServiceChargePayableAccount(propertyId: string): Promise<string> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    const settings = (property?.settings as any) || {};
    const liabilityMap = settings?.accountingConfig?.liabilityAccounts || {};
    const configuredCode = liabilityMap['SERVICE_CHARGE'] || '2210';

    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId, code: configuredCode, isActive: true }
    });

    if (!account) {
      throw new Error(`Service Charge Liability GL Account Code ${configuredCode} is missing or inactive for property ${propertyId}.`);
    }

    return account.id;
  }
}
