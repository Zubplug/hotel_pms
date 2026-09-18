using System;

namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Offline mirror of the cloud CityLedgerAllocation record.
/// An allocation represents the partial or full application of a REFUND_OWED
/// credit entry to a specific folio.  The original entry's amount is NEVER
/// mutated; available credit is always computed as:
///
///     Available = Entry.Amount - SUM(Allocations.Amount)
///
/// SyncStatus lifecycle:
///   PENDING   – created locally, not yet pushed to cloud
///   SYNCED    – cloud accepted the allocation
///   CONFLICTED – cloud rejected it (credit already used elsewhere)
/// </summary>
public class LocalCityLedgerAllocation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>Id of the parent REFUND_OWED CityLedgerEntry.</summary>
    public string CreditEntryId { get; set; } = string.Empty;

    /// <summary>Id of the folio this credit is being applied to.</summary>
    public string FolioId { get; set; } = string.Empty;

    /// <summary>Id of the guest who owns the credit entry.</summary>
    public string GuestId { get; set; } = string.Empty;

    public string PropertyId { get; set; } = string.Empty;

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "NGN";

    /// <summary>
    /// Stable client-generated idempotency token used by the cloud push handler
    /// to detect and de-duplicate replayed outbox events.
    /// </summary>
    public string OfflineOperationId { get; set; } = Guid.NewGuid().ToString();

    public string AppliedBy { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>PENDING | SYNCED | CONFLICTED</summary>
    public string SyncStatus { get; set; } = "PENDING";

    /// <summary>
    /// Populated only when SyncStatus == CONFLICTED.
    /// e.g. "INSUFFICIENT_CREDIT"
    /// </summary>
    public string? ConflictReason { get; set; }

    /// <summary>Human-readable message from the server for UI display.</summary>
    public string? ServerMessage { get; set; }
}
