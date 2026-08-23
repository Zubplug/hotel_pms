namespace LodgeCore.Desktop.Data.Entities;

public class LocalLockOperation
{
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    
    public string? ReservationId { get; set; }
    public LocalReservation? Reservation { get; set; }
    
    public string? LockId { get; set; }
    public string? RoomId { get; set; }
    public string? CredentialId { get; set; }
    public string? CommandId { get; set; }
    public string? IdempotencyKey { get; set; }

    public string Operation { get; set; } = string.Empty;
    public string Status { get; set; } = "QUEUED";
    
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? PayloadHash { get; set; }
    public int AttemptCount { get; set; } = 0;

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public string? AgentId { get; set; }
    public string? DeviceId { get; set; }
    public string? MetadataJson { get; set; }
    
    // Virtual property to hold command data for the UI
    public string? CommandJson { get; set; } 
}
