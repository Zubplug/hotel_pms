namespace LodgeCore.Desktop.Data.Entities;

public class LocalReservation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string GuestId { get; set; } = string.Empty;
    public LocalGuest? Guest { get; set; }
    
    public string? RoomTypeId { get; set; }
    public string? RoomId { get; set; }
    public string? RoomNumber { get; set; }
    public string? SpecialRequests { get; set; }
    
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int Adults { get; set; } = 1;
    public int Children { get; set; } = 0;
    public decimal DepositRequired { get; set; } = 0m;
    public decimal DepositPaid { get; set; } = 0m;
    public string? ConfirmationNumber { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, CHECKED_IN, CHECKED_OUT, CANCELLED
    
    public LocalFolio? Folio { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // For sync conflict detection
    public int Version { get; set; } = 1;
    public int LocalSequence { get; set; } = 0;
    public bool IsDirty { get; set; } = false; // Needs to be synced
}
