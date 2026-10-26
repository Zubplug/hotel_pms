namespace LodgeCore.Desktop.Services;

public sealed class CustomerDisplayProjection
{
    public string State { get; set; } = "IDLE";
    public string Currency { get; set; } = "NGN";
    public string? PropertyName { get; set; }
    public string? LogoUrl { get; set; }
    public string WelcomeMessage { get; set; } = "Welcome to LodgeCore";
    public List<CustomerDisplayItem> Items { get; set; } = new();
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal ServiceCharge { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeDue { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentMessage { get; set; }
}

public sealed class CustomerDisplayItem
{
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
}
