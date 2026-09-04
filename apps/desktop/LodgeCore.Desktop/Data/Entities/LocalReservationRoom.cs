namespace LodgeCore.Desktop.Data.Entities;

public class LocalReservationRoom
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ReservationId { get; set; } = string.Empty;
    public LocalReservation? Reservation { get; set; }

    public string RoomTypeId { get; set; } = string.Empty;
    public string? RoomId { get; set; }
    public LocalRoom? Room { get; set; }

    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }

    public int Adults { get; set; } = 1;
    public int Children { get; set; } = 0;

    public string? DiscountType { get; set; }
    public decimal? DiscountAmount { get; set; }
    public decimal? DiscountPercent { get; set; }
    public string? DiscountReason { get; set; }
    public string? DiscountApprovalId { get; set; }
    public string? DiscountApprovingManagerId { get; set; }

    public string Status { get; set; } = "PENDING";
}
