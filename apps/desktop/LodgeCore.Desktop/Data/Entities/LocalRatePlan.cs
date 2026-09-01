using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalRatePlan
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = "STANDARD";
    public bool IsPublic { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
}

public class LocalRate
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string RatePlanId { get; set; } = string.Empty;
    public string RoomTypeId { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "NGN";
    public DateTime UpdatedAt { get; set; }
}
