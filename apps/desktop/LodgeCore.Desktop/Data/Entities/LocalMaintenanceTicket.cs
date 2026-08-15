namespace LodgeCore.Desktop.Data.Entities;

public class LocalMaintenanceTicket
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string RoomId { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    
    public string IssueDescription { get; set; } = string.Empty;
    public string Priority { get; set; } = "NORMAL"; // LOW, NORMAL, HIGH, URGENT
    public string Status { get; set; } = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED
    
    public bool RequiresRoomRestriction { get; set; } = false; // e.g. Out of Order

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public int Version { get; set; } = 1;
    public bool IsDirty { get; set; } = false;
}
