namespace LodgeCore.Desktop.Data.Entities;

/// <summary>Read-only event booking snapshot used by the offline Front Desk timeline.</summary>
public class LocalEventScheduleItem
{
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
    public string EventStatus { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public int ExpectedGuests { get; set; }
    public string HallId { get; set; } = string.Empty;
    public string HallName { get; set; } = string.Empty;
    public string HallCode { get; set; } = string.Empty;
    public int HallCapacity { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int SetupBufferMinutes { get; set; }
    public int TeardownBufferMinutes { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
