using System.Text.Json;
using Microsoft.Maui.Storage;

namespace LodgeCore.Desktop.Services;

public record DesktopSession(string SessionId, string UserId, string DeviceId, string PropertyId, string Role, string[] Permissions, DateTime ExpiresAt, DateTime CreatedAt, DateTime LastOnlineValidationAt, int SessionVersion);

/// <summary>
/// Manages secure local storage of the Device Identity and Auth Tokens.
/// Uses the native OS credential store (Windows Credential Manager / Keychain).
/// </summary>
public class AuthManager
{
    private const string DeviceIdKey = "LodgeCore_DeviceId";
    private const string AuthTokenKey = "LodgeCore_AuthToken";
    private const string SessionDataKey = "LodgeCore_SessionData";

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

    public async Task ProvisionDeviceAsync(string userId, string propertyId, string role, string deviceToken, string[] permissions, int sessionVersion)
    {
        var deviceId = await GetOrCreateDeviceIdAsync();
        
        // Store the long-lived device token
        await SecureStorage.Default.SetAsync(AuthTokenKey, deviceToken);

        // Derive and store the active offline session
        var session = new DesktopSession(
            SessionId: Guid.NewGuid().ToString(),
            UserId: userId,
            DeviceId: deviceId,
            PropertyId: propertyId,
            Role: role,
            Permissions: permissions ?? Array.Empty<string>(),
            ExpiresAt: DateTime.UtcNow.AddDays(7), // 7-day maximum offline authorization
            CreatedAt: DateTime.UtcNow,
            LastOnlineValidationAt: DateTime.UtcNow,
            SessionVersion: sessionVersion
        );

        var sessionJson = JsonSerializer.Serialize(session);
        await SecureStorage.Default.SetAsync(SessionDataKey, sessionJson);
    }

    public async Task<DesktopSession?> GetSessionAsync()
    {
        var sessionJson = await SecureStorage.Default.GetAsync(SessionDataKey);
        if (string.IsNullOrEmpty(sessionJson)) return null;

        try
        {
            var session = JsonSerializer.Deserialize<DesktopSession>(sessionJson);
            if (session != null && session.ExpiresAt > DateTime.UtcNow)
            {
                return session;
            }
        }
        catch
        {
            // Invalid JSON
        }
        
        return null;
    }

    public async Task<string?> GetAuthTokenAsync()
    {
        return await SecureStorage.Default.GetAsync(AuthTokenKey);
    }

    public void ClearAuthData()
    {
        SecureStorage.Default.Remove(AuthTokenKey);
        SecureStorage.Default.Remove(SessionDataKey);
    }
}
