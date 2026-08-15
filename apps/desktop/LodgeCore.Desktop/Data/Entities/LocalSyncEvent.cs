namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Represents the Event-Based Synchronization engine's immutable operation log.
/// Every mutation (create, update, delete) generates one of these.
/// </summary>
public class LocalSyncEvent
{
    public string OperationId { get; set; } = Guid.NewGuid().ToString();
    public string EntityType { get; set; } = string.Empty; // e.g. "RESERVATION", "FOLIO"
    public string EntityId { get; set; } = string.Empty;
    
    public string OperationType { get; set; } = "UPDATE"; // CREATE, UPDATE, DELETE
    
    // The actual payload to be synced (JSON string)
    public string PayloadJson { get; set; } = string.Empty;
    
    public string Status { get; set; } = "PENDING"; // PENDING, SYNCED, CONFLICT, FAILED
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Identity fields to know who did it
    public string? UserId { get; set; }
    public string? DeviceId { get; set; }
}
