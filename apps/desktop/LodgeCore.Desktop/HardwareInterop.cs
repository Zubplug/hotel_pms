using System.Text.Json;
using LodgeCore.HardwareAgent.Locks;

namespace LodgeCore.Desktop;

public class HardwareInterop
{
    private readonly ILockProvider _lockProvider;

    public HardwareInterop(ILockProvider lockProvider)
    {
        _lockProvider = lockProvider;
    }

    public async Task<string> ReadCardAsync()
    {
        try
        {
            var result = await _lockProvider.ReadCardAsync(CancellationToken.None);
            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> EncodeCardAsync(string lockCode)
    {
        try
        {
            var result = await _lockProvider.EncodeCardAsync(lockCode, CancellationToken.None);
            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> CancelCardAsync()
    {
        try
        {
            var result = await _lockProvider.CancelCardAsync(CancellationToken.None);
            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
}
