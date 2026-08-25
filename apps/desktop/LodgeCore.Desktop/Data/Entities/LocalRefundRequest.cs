namespace LodgeCore.Desktop.Data.Entities;

public class LocalRefundRequest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string ReservationId { get; set; } = string.Empty;
    public string FolioId { get; set; } = string.Empty;
    public string PaymentId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
    public decimal RequestedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string Currency { get; set; } = "NGN";
    public string RequestedMethod { get; set; } = "ORIGINAL_PAYMENT";
    public string? ApprovedMethod { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING_APPROVAL";
    public int CurrentApprovalStep { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDirty { get; set; }
}
