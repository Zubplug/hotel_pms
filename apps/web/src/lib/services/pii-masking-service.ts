/**
 * Enterprise PII & Sensitive Compensation Masking Service
 * Protects Bank Verification Numbers (BVN), National Identification Numbers (NIN),
 * State Tax IDs (TIN), bank account numbers, and confidential compensation figures.
 */

export class PiiMaskingService {
  /**
   * Masks a Bank Verification Number (BVN) showing only last 4 digits.
   * Example: "22334455667" -> "******5667"
   */
  public static maskBvn(bvn?: string | null, allowUnmasked: boolean = false): string | null {
    if (!bvn) return null;
    if (allowUnmasked) return bvn;
    const clean = bvn.trim();
    if (!clean) return null;
    if (clean.length <= 4) return '****';
    return `******${clean.slice(-4)}`;
}
  /**
   * Masks a National Identification Number (NIN) showing only last 4 digits.
   */
  public static maskNin(nin?: string | null, allowUnmasked: boolean = false): string | null {
    if (!nin) return null;
    if (allowUnmasked) return nin;
    const clean = nin.trim();
    if (!clean) return null;
    if (clean.length <= 4) return '****';
    return `******${clean.slice(-4)}`;
  }

  /**
   * Masks a State Tax Identification Number (TIN).
   */
  public static maskTaxId(taxId?: string | null, allowUnmasked: boolean = false): string | null {
    if (!taxId) return null;
    if (allowUnmasked) return taxId;
    const clean = taxId.trim();
    if (!clean) return null;
    if (clean.length <= 4) return '****';
    return `***${clean.slice(-4)}`;
  }

  /**
   * Alias for maskTaxId
   */
  public static maskTin(tin?: string | null, allowUnmasked: boolean = false): string | null {
    return this.maskTaxId(tin, allowUnmasked);
  }

  /**
   * Masks a bank account number showing only last 4 digits.
   * Example: "0123456789" -> "******6789"
   */
  public static maskAccountNumber(acct?: string | null, allowUnmasked: boolean = false): string | null {
    if (!acct) return null;
    if (allowUnmasked) return acct;
    const clean = acct.trim();
    if (!clean) return null;
    if (clean.length <= 4) return '****';
    return `******${clean.slice(-4)}`;
  }

  /**
   * Masks Pension RSA PIN showing only last 4 digits.
   * Example: "PEN100998877" -> "PEN******8877"
   */
  public static maskRsaPin(rsa?: string | null, allowUnmasked: boolean = false): string | null {
    if (!rsa) return null;
    if (allowUnmasked) return rsa;
    const clean = rsa.trim();
    if (!clean) return null;
    if (clean.length <= 6) return '******';
    return `${clean.slice(0, 3)}******${clean.slice(-4)}`;
  }

  /**
   * Masks confidential employee base salary or allowances.
   */
  public static maskCompensation(amount: number, allowUnmasked: boolean = false): number | null {
    if (allowUnmasked) return amount;
    return null;
  }
}
