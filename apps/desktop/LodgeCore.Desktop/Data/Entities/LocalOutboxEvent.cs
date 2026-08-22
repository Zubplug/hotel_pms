namespace LodgeCore.Desktop.Data.Entities;

public class LocalOutboxEvent
{
    // Immutable event ID
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    // Protection against duplicate submission
    public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();

    public string PropertyId { get; set; } = string.Empty;
    public string? DeviceId { get; set; }
    public string? OperatorId { get; set; }

    // Concurrency control
    public string AggregateType { get; set; } = string.Empty; // e.g. "FOLIO", "RESERVATION"
    public string AggregateId { get; set; } = string.Empty;
    public int AggregateVersion { get; set; } = 1;

    // Domain event
    public string EventType { get; set; } = string.Empty; // e.g. "CHECK_IN", "ROOM_CHARGE"
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    // Local ordering (monotonic)
    public int Sequence { get; set; } = 1;

    public string PayloadJson { get; set; } = "{}";
    
    // Synchronization Lifecycle
    public string Status { get; set; } = "PENDING"; // PENDING, PROCESSING, SYNCED, FAILED, CONFLICT
    public string? LastError { get; set; }
    public int AttemptCount { get; set; } = 0;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastAttemptAt { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public DateTime? SyncedAt { get; set; }
}
