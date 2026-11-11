using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Durable, property-scoped checkpoint for guest replication.
/// </summary>
public class LocalGuestSyncCheckpoint
{
    [Key]
    public string PropertyId { get; set; } = string.Empty;

    public string? Cursor { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
