namespace LodgeCore.Desktop.Data.Entities;

public class LocalEventInvoice
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string? EventId { get; set; }
    public string? FolioId { get; set; }
    public string? CityLedgerEntryId { get; set; }
    public string? CityLedgerAccountId { get; set; }
    public string? CityLedgerInvoiceId { get; set; }
    public string? EventInvoiceWorkflowStatus { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string Status { get; set; } = "UNPAID";
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Currency { get; set; } = "NGN";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
