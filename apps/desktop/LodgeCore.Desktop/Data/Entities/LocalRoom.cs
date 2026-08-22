using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalRoom
{
    [Key]
    public string Id { get; set; } = string.Empty;

    public string PropertyId { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // CLEAN, DIRTY, OUT_OF_ORDER, MAINTENANCE
    public string HousekeepingStatus { get; set; } = string.Empty;
    public string MaintenanceStatus { get; set; } = string.Empty;
    public string RoomTypeId { get; set; } = string.Empty;
    public int Floor { get; set; }
    
    // Derived states (updated during sync or local mutations)
    public bool IsOccupied { get; set; }

    /// <summary>
    /// Vendor-assigned lock code, synced from the cloud PMS.
    /// If null, the room Number is used as the hardware address.
    /// </summary>
    public string? LockSystemCode { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
