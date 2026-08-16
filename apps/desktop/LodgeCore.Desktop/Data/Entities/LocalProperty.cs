namespace LodgeCore.Desktop.Data.Entities;

public class LocalProperty
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public string Timezone { get; set; } = string.Empty;
    public DateTime BusinessDate { get; set; }
    public bool IsActive { get; set; }
}
