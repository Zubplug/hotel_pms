using System.ComponentModel.DataAnnotations;

namespace LodgeCore.Desktop.Data.Entities;

public class LocalCorporateAccount
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? RatePlanId { get; set; }
    public string? CityLedgerAccountId { get; set; }
    public decimal CreditLimit { get; set; }
    public bool ExemptFromHighBalance { get; set; }
    public string DepositPolicy { get; set; } = "STANDARD";
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
    public int SyncVersion { get; set; }
}
