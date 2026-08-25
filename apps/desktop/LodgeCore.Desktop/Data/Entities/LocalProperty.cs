namespace LodgeCore.Desktop.Data.Entities;

public class LocalProperty
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public string Timezone { get; set; } = "UTC";
    public DateTime BusinessDate { get; set; }
    public bool IsActive { get; set; }

    /// <summary>
    /// How many hours before midnight of the CheckInDate a keycard may be issued
    /// for a PENDING (not yet checked-in) reservation.
    /// Synced from cloud PMS property settings. Default: 2.
    /// </summary>
    public int EarlyCheckinWindowHours { get; set; } = 2;
    public string BankingModel { get; set; } = "CENTRAL_CASHIER";
    public decimal DepositApprovalThreshold { get; set; } = 250000m;
    public decimal CreditAdjustmentApprovalThreshold { get; set; } = 1m;
    public decimal RefundApprovalThreshold { get; set; } = 1m;
    public string OfflineHighValueDepositPolicy { get; set; } = "BLOCK";
    public string NoShowCutoffTime { get; set; } = "02:00";
    public int NoShowGracePeriodMinutes { get; set; }
    public string NoShowChargeType { get; set; } = "FIRST_NIGHT";
    public decimal NoShowChargeValue { get; set; }
    public bool NoShowRefundableUnusedNights { get; set; } = true;
    public bool NoShowAllowReinstatement { get; set; } = true;
    public bool NoShowReinstatementRequiresApproval { get; set; } = true;
}
