using System.Text.Json;

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

    private static decimal ReadDecimal(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value)) return 0m;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var text) ? text : 0m;
    }

    public decimal OutstandingBalance => Math.Max(0m, TotalCharges - TotalPayments - AppliedCreditAmount);
    public decimal NetBalance => OutstandingBalance;
    public string? Currency { get; set; }

    // Storing transactions as JSON string for simplicity offline, or we could make a separate table
    public string TransactionsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int Version { get; set; } = 1;
    public int LocalSequence { get; set; } = 0;
    public bool IsDirty { get; set; } = false;
}
