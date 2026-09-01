using System;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalCityLedgerEntry
{
    public string Id { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    
    // TRANSFER_IN (Reservation Checkout routed to AR), PAYMENT, INVOICE_GENERATED
    public string Type { get; set; } = "TRANSFER_IN";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "NGN";
    
    public string? ReservationId { get; set; }
    public string? GuestId { get; set; }
    public string? FolioId { get; set; }
    public string? PosTransactionId { get; set; }
    
    public string? Description { get; set; }
    public string? OperatorId { get; set; }
    public string? DeviceId { get; set; }
    public string? IdempotencyKey { get; set; }
    
    public DateTime BusinessDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public int Version { get; set; } = 1;
}
