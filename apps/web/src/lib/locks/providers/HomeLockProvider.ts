import { LockProvider, LockProviderCapabilities, IssueCredentialParams, RevokeCredentialParams } from '../types';

export class HomeLockProvider implements LockProvider {
  readonly name = 'HOMELOCK';

  readonly capabilities: LockProviderCapabilities = {
    supportsDuplicateCards: true, // Supported via iflags = 8
    supportsCardReplacement: true, // Supported via iflags = 0 (override)
    supportsCardRevocation: true, // Supported via TP_CancelCardEx2
    supportsCardRead: true, // Supported via TP_ReadGuestCardEx2
    supportsOnlineUnlock: false, // Purely offline RFID
    supportsOfflineCredential: true, // This is an offline RFID system
  };

  createIssueCommandPayload(params: IssueCredentialParams): Record<string, unknown> {
    // According to LockSDK.h:
    // iflags: 0 (override existing card), 8 (duplicate card - don't override)
    const iflags = params.isDuplicate ? 8 : 0;
    
    return {
      action: 'ISSUE',
      lockCode: params.lockCode, // e.g., "1.2.8102"
      checkinTime: params.validFrom.toISOString(), // formatting (YYYY-MM-DD HH:mm:ss) will be handled by C# agent
      checkoutTime: params.validUntil.toISOString(), 
      iflags: iflags,
      waitMs: 1000, // Tell the C# agent to use a short 1-second timeout per polling loop
    };
  }

  createRevokeCommandPayload(params: RevokeCredentialParams): Record<string, unknown> {
    return {
      action: 'REVOKE',
      lockCode: params.lockCode,
      cardSerialNumber: params.cardSerialNumber,
      waitMs: 1000,
    };
  }
}
