using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalBreakfastRedemption
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string ReservationId { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public int CoversRedeemed { get; set; } = 1;
    public string? PosOrderId { get; set; }
    public string Method { get; set; } = "POS_TICKET"; // 'POS_TICKET' or 'BUFFET_BATCH'
    public string? ServerStaffId { get; set; }
    public string OperationId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
