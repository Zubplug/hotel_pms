using Microsoft.Maui.Storage;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Manages secure local storage of the Device Identity and Auth Tokens.
/// Uses the native OS credential store (Windows Credential Manager / Keychain).
/// </summary>
public class AuthManager
{
    private const string DeviceIdKey = "LodgeCore_DeviceId";
    private const string AuthTokenKey = "LodgeCore_AuthToken";

    public async Task<string> GetOrCreateDeviceIdAsync()
    {
        var deviceId = await SecureStorage.Default.GetAsync(DeviceIdKey);
        
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = Guid.NewGuid().ToString();
            await SecureStorage.Default.SetAsync(DeviceIdKey, deviceId);
        }

        return deviceId;
    }

    public async Task SaveAuthTokenAsync(string token)
    {
        await SecureStorage.Default.SetAsync(AuthTokenKey, token);
    }

    public async Task<string?> GetAuthTokenAsync()
    {
        return await SecureStorage.Default.GetAsync(AuthTokenKey);
    }

    public void ClearAuthData()
    {
        SecureStorage.Default.Remove(AuthTokenKey);
    }
}
