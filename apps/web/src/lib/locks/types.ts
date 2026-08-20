import { LockCredential, LockOperation } from '@hotel-pms/db';

export interface LockProviderCapabilities {
  supportsDuplicateCards: boolean;
  supportsCardReplacement: boolean;
  supportsCardRevocation: boolean;
  supportsCardRead: boolean;
  supportsOnlineUnlock: boolean;
  supportsOfflineCredential: boolean;
}

export interface IssueCredentialParams {
  operationId: string;
  reservationId: string;
  guestId?: string;
  roomId: string;
  lockId: string;
  lockCode: string;
  propertyId: string;
  validFrom: Date;
  validUntil: Date;
  isDuplicate: boolean;
}

export interface RevokeCredentialParams {
  operationId: string;
  credentialId: string;
  lockId: string;
  lockCode: string;
  propertyId: string;
  cardSerialNumber?: string;
}

export interface LockProvider {
  /**
   * The unique identifier for this provider (e.g. 'HOMELOCK', 'SIMULATED')
   */
  readonly name: string;

  /**
   * Hardware capabilities
   */
  readonly capabilities: LockProviderCapabilities;

  /**
   * Generate the payload required by the Hardware Agent to issue a card.
   * This payload will be wrapped in a LockCommand and pushed to the local queue.
   */
  createIssueCommandPayload(params: IssueCredentialParams): Record<string, unknown>;

  /**
   * Generate the payload required by the Hardware Agent to revoke a card
   */
  createRevokeCommandPayload(params: RevokeCredentialParams): Record<string, unknown>;
}
