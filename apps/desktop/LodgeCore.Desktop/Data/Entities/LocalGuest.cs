namespace LodgeCore.Desktop.Data.Entities;

public class LocalGuest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    
    public ICollection<LocalReservation> Reservations { get; set; } = new List<LocalReservation>();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public int Version { get; set; } = 1;
    public bool IsDirty { get; set; } = false;
}
