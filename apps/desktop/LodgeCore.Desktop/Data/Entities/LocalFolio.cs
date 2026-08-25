namespace LodgeCore.Desktop.Data.Entities;

public class LocalFolio
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string ReservationId { get; set; } = string.Empty;
    public LocalReservation? Reservation { get; set; }
    
    public string Status { get; set; } = "OPEN";
    public decimal TotalCharges { get; set; }
    public decimal TotalPayments { get; set; }
    public decimal AvailableCredit { get; set; }
    public decimal OutstandingBalance => TotalCharges - TotalPayments;
    public decimal NetBalance => OutstandingBalance - AvailableCredit;
    public string? Currency { get; set; }

    // Storing transactions as JSON string for simplicity offline, or we could make a separate table
    public string TransactionsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int Version { get; set; } = 1;
    public int LocalSequence { get; set; } = 0;
    public bool IsDirty { get; set; } = false;
}
