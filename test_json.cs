using System;
using System.Text.Json;

public record PaymentReceiptData(
    string ReceiptNumber,
    string GuestName,
    string RoomNumber,
    string FolioNumber,
    decimal AmountPaid,
    string PaymentMethod,
    string? PaymentReference,
    decimal PreviousBalance,
    decimal RemainingBalance,
    string CashierName,
    string Currency,
    string? PropertyName,
    string? PropertyAddress,
    DateTime PrintedAt
);

class Program {
    static void Main() {
        var json = "{\"receiptNumber\":\"123\", \"guestName\":\"John Doe\", \"amountPaid\": 100.50}";
        try {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var data = JsonSerializer.Deserialize<PaymentReceiptData>(json, options);
            Console.WriteLine("Success: " + data.GuestName + " " + data.PrintedAt);
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
