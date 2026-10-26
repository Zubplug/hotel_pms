using System.Collections.ObjectModel;

namespace LodgeCore.Desktop;

public partial class CustomerDisplayPage : ContentPage
{
    public ObservableCollection<Services.CustomerDisplayItem> Items { get; } = new();

    public CustomerDisplayPage()
    {
        InitializeComponent();
        BindingContext = this;
    }

    public void Apply(Services.CustomerDisplayProjection projection)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            Items.Clear();
            foreach (var item in projection.Items) Items.Add(item);

            BrandLabel.Text = projection.PropertyName ?? "LodgeCore";
            StateLabel.Text = projection.State switch
            {
                "ORDER" => "Your order",
                "PAYMENT_PROCESSING" => "Payment processing",
                "PAYMENT_CONFIRMED" => "Payment confirmed",
                _ => projection.WelcomeMessage
            };
            SubtotalLabel.Text = Format(projection.Subtotal, projection.Currency);
            TaxLabel.Text = Format(projection.Tax + projection.ServiceCharge - projection.Discount, projection.Currency);
            TotalLabel.Text = Format(projection.Total, projection.Currency);
            FooterLabel.Text = projection.State == "PAYMENT_CONFIRMED"
                ? $"Paid {Format(projection.AmountPaid, projection.Currency)}  •  Change {Format(projection.ChangeDue, projection.Currency)}\n{projection.PaymentMessage ?? "Thank you"}"
                : projection.State == "PAYMENT_PROCESSING" ? "Please wait…" : "Please review your order before payment";
        });
    }

    private static string Format(decimal amount, string currency) =>
        $"{(currency.Equals("NGN", StringComparison.OrdinalIgnoreCase) ? "₦" : currency + " ")}{amount:N2}";
}
