import { LockProvider, LockProviderCapabilities, IssueCredentialParams, RevokeCredentialParams } from '../types';

export class SimulatedLockProvider implements LockProvider {
  readonly name = 'SIMULATED';

  readonly capabilities: LockProviderCapabilities = {
    supportsDuplicateCards: true,
    supportsCardReplacement: true,
    supportsCardRevocation: true,
    supportsCardRead: true,
    supportsOnlineUnlock: true,
    supportsOfflineCredential: true,
  };

  createIssueCommandPayload(params: IssueCredentialParams): Record<string, unknown> {
    return {
      action: 'ISSUE',
      lockCode: params.lockCode,
      isDuplicate: params.isDuplicate,
      validFrom: params.validFrom.toISOString(),
      validUntil: params.validUntil.toISOString(),
      simulatedWaitMs: 3000, // Tell the simulated agent to wait 3 seconds before "detecting" a card
    };
  }

  createRevokeCommandPayload(params: RevokeCredentialParams): Record<string, unknown> {
    return {
      action: 'REVOKE',
      lockCode: params.lockCode,
      cardSerialNumber: params.cardSerialNumber,
    };
  }
}
