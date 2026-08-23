namespace LodgeCore.Desktop.Data.Entities;

public class LocalLockCredential
{
    public string Id { get; set; } = string.Empty;
    public string ReservationId { get; set; } = string.Empty;
    public LocalReservation? Reservation { get; set; }
    
    public string? GuestId { get; set; }
    public string RoomId { get; set; } = string.Empty;
    public string LockId { get; set; } = string.Empty;

    public string CredentialType { get; set; } = "rfid";
    public string Status { get; set; } = "PENDING"; // PENDING, ACTIVE, REVOKED, EXPIRED, FAILED
    
    public DateTime ValidFrom { get; set; }
    public DateTime ValidUntil { get; set; }
    
    public string? CardSerialNumber { get; set; }
    public string? IssueOperationId { get; set; }
    
    public DateTime? IssuedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
