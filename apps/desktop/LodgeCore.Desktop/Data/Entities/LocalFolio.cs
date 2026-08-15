namespace LodgeCore.Desktop.Data.Entities;

public class LocalFolio
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ReservationId { get; set; } = string.Empty;
    public LocalReservation? Reservation { get; set; }
    
    public string Status { get; set; } = "OPEN";
    public decimal TotalCharges { get; set; }
    public decimal TotalPayments { get; set; }
    public decimal OutstandingBalance => TotalCharges - TotalPayments;

    // Storing transactions as JSON string for simplicity offline, or we could make a separate table
    public string TransactionsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int Version { get; set; } = 1;
    public bool IsDirty { get; set; } = false;
}
