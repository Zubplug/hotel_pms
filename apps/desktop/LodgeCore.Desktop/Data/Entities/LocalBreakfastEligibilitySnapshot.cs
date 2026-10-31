using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalBreakfastEligibilitySnapshot
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public DateTime RedeemableBusinessDate { get; set; }
    public string ReservationId { get; set; } = string.Empty;
    public string ReservationRoomId { get; set; } = string.Empty;
    public string GuestId { get; set; } = string.Empty;
    public string? RoomId { get; set; }
    public string RoomNumber { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public int MaxCoversAllowed { get; set; } = 1;
    public string Status { get; set; } = "ELIGIBLE";
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
