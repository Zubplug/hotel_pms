namespace LodgeCore.Desktop.Data.Entities;

public class LocalHousekeepingTask
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    
    public string TaskType { get; set; } = "CLEANING"; // CLEANING, INSPECTION, MAINTENANCE
    public string Status { get; set; } = "CLEANING"; // CLEANING, INSPECTED, MAINTENANCE_REQUIRED, CANCELLED
    
    public string? AssignedToUserId { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int Version { get; set; } = 1;
    public bool IsDirty { get; set; } = false;
}
