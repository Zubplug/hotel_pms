using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Offline pool access projection. The cloud remains authoritative for
/// configuration and final capacity validation; this record lets the pool
/// desk continue operating while disconnected and gives sync a durable event
/// to replay after reconnect.
/// </summary>
public class LocalPoolEntry
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string FacilityId { get; set; } = string.Empty;
    public string PassTypeId { get; set; } = string.Empty;
    public string? GuestId { get; set; }
    public string? ReservationId { get; set; }
    public string? FolioId { get; set; }
    public string? PosOrderId { get; set; }
    public string EntryNumber { get; set; } = string.Empty;
    public string? Identifier { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime EntryDate { get; set; }
    public DateTime? AdmittedAt { get; set; }
    public DateTime? ExitedAt { get; set; }
    public int GuestCount { get; set; } = 1;
    public bool WaiverAccepted { get; set; }
    public string? Notes { get; set; }
    public string? OperationId { get; set; }
    public string? DeviceId { get; set; }
    public string? CreatedBy { get; set; }
    public string? CheckedInBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
