using System.Text.Json;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalFolio
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PropertyId { get; set; } = string.Empty;
    public string? ReservationId { get; set; }
    public LocalReservation? Reservation { get; set; }
    public string? CorporateAccountId { get; set; }
    public LocalCorporateAccount? CorporateAccount { get; set; }
    public string Type { get; set; } = "ROOM";
    
    public string Status { get; set; } = "OPEN";
    public decimal TotalCharges { get; set; }
    public decimal TotalPayments { get; set; }
    public decimal AvailableCredit { get; set; }
    public decimal AppliedCreditAmount
    {
        get
        {
            try
            {
                using var document = JsonDocument.Parse(TransactionsJson ?? "{}");
                if (!document.RootElement.TryGetProperty("credits", out var credits) || credits.ValueKind != JsonValueKind.Array)
                    return 0m;

                return credits.EnumerateArray().Sum(credit =>
                {
                    var amount = ReadDecimal(credit, "amount");
                    var remaining = credit.TryGetProperty("remainingAmount", out _) ? ReadDecimal(credit, "remainingAmount") : amount;
                    return Math.Max(0m, amount - remaining);
                });
            }
            catch
            {
                return 0m;
            }
        }
    }

    // Advance deposits are already included in TotalPayments. Only non-cash
    // folio credits (for example downgrade/credit adjustments) need an
    // additional balance reduction when they are applied.
    public decimal AppliedCreditAdjustmentAmount
    {
        get
        {
            try
            {
                using var document = JsonDocument.Parse(TransactionsJson ?? "{}");
                if (!document.RootElement.TryGetProperty("credits", out var credits) || credits.ValueKind != JsonValueKind.Array)
                    return 0m;

                return credits.EnumerateArray().Sum(credit =>
                {
                    var type = credit.TryGetProperty("type", out var typeValue) ? typeValue.GetString() : null;
                    if (string.Equals(type, "ADVANCE_DEPOSIT", StringComparison.OrdinalIgnoreCase)) return 0m;
                    var amount = ReadDecimal(credit, "amount");
                    var remaining = credit.TryGetProperty("remainingAmount", out _) ? ReadDecimal(credit, "remainingAmount") : amount;
                    return Math.Max(0m, amount - remaining);
                });
            }
            catch
            {
                return 0m;
            }
        }
    }

    private static decimal ReadDecimal(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value)) return 0m;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var text) ? text : 0m;
    }

    public decimal NetBalance => TotalCharges - TotalPayments - AppliedCreditAdjustmentAmount;
    public decimal OutstandingBalance => Math.Max(0m, NetBalance);
    public string? Currency { get; set; }

    // Storing transactions as JSON string for simplicity offline, or we could make a separate table
    public string TransactionsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int Version { get; set; } = 1;
    public int LocalSequence { get; set; } = 0;
    public bool IsDirty { get; set; } = false;
}
