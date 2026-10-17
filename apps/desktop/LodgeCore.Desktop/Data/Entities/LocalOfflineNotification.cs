namespace LodgeCore.Desktop.Data.Entities;

/// <summary>
/// A cloud-originated booking alert cached locally so the terminal can alert
/// staff while the Front Desk or POS is offline.
/// </summary>
public sealed class LocalOfflineNotification
{
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string NotificationType { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string MetadataJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Acknowledged { get; set; }
}
