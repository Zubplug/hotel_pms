using System;
using System.Collections.Generic;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Data-transfer object returned by LocalRepository.GetGuestCreditsAsync.
/// Represents a single guest's computed available credit for display in the
/// Front Desk "Guest Credits (Refund Owed)" tab.
/// </summary>
public class GuestCreditSummary
{
    public class CreditEntrySummary
    {
        public string Id { get; set; } = string.Empty;
        public decimal AvailableAmount { get; set; }
    }

    public string GuestId { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;

    /// <summary>Dynamically computed: Entry.Amount - SUM(Allocations.Amount)</summary>
    public decimal AvailableAmount { get; set; }
    public string Currency { get; set; } = "NGN";

    public DateTime LastActivityAt { get; set; }

    /// <summary>
    /// IDs of the underlying REFUND_OWED entries that make up this credit.
    /// Passed back to ApplyGuestCreditAsync when the receptionist applies credit.
    /// </summary>
    public List<string> CreditEntryIds { get; set; } = new();
    public List<CreditEntrySummary> CreditEntries { get; set; } = new();
}
