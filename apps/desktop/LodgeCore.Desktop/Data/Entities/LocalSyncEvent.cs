using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// Represents the Event-Based Synchronization engine's immutable operation log.
/// </summary>
public class LocalSyncEvent
{
    [Key]
    public string OperationId { get; set; } = Guid.NewGuid().ToString();
    
    public long SequenceNumber { get; set; }
    
    // Identity fields (Trusted)
    public string TerminalId { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string OperatorId { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty; 
    public string EntityId { get; set; } = string.Empty;
    
    // Business event type: ORDER_CREATED, PAYMENT_RECORDED, etc.
    public string OperationType { get; set; } = string.Empty; 
    
    public string PayloadJson { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    
    // PENDING, PROCESSING, SYNCED, CONFLICT, FAILED
    public string Status { get; set; } = "PENDING"; 
    
    public int AttemptCount { get; set; } = 0;
    public DateTime? LastAttemptAt { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
