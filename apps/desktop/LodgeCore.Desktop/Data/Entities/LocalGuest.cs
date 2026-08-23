namespace LodgeCore.Desktop.Data.Entities;

public class LocalGuest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrganizationId { get; set; } = string.Empty;
    
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Nationality { get; set; }
    
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    
    public string? IdType { get; set; }
    public string? CompanyName { get; set; }
    public bool IsVip { get; set; }
    public string? Notes { get; set; }
    
    public ICollection<LocalReservation> Reservations { get; set; } = new List<LocalReservation>();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public int Version { get; set; } = 1;
    public bool IsDirty { get; set; } = false;
}
