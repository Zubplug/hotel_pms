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
}
