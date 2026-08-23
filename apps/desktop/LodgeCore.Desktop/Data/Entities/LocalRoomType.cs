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

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
