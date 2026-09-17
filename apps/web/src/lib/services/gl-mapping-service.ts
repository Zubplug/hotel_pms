import { prisma } from '@hotel-pms/db';

export class GLMappingService {
  /**
   * Resolves the Asset/Clearing GL account ID for a given Payment Method.
   * Maps:
   * CARD -> 1110 Credit Card Receivable
   * BANK_TRANSFER -> 1130 Bank Transfer Receivable
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
        case 'CARD':
        case 'POS':
          targetCode = '1110'; // Credit Card Receivable
          break;
        case 'BANK_TRANSFER':
          targetCode = '1130'; // Bank Transfer Receivable
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
}
