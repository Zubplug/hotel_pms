using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalRoomType
{
    [Key]
    public string Id { get; set; } = string.Empty;

    public string PropertyId { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public string Currency { get; set; } = "NGN";
    
    public int MaxOccupancy { get; set; }
    public int MaxAdults { get; set; } = 2;
    public int MaxChildren { get; set; } = 0;
    public string? DefaultBedConfig { get; set; }
    public int TotalRooms { get; set; }
    public bool IsActive { get; set; } = true;

    // Cached Reach configuration. The front desk does not settle commissions
    // offline, but it must retain the property configuration with the room
    // type so the local cache remains consistent until reconnect.
    public bool ReferralEnabled { get; set; } = true;
    public string ReferralCommissionMode { get; set; } = "PERCENT";
    public decimal ReferralCommissionValue { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
