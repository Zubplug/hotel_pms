using System.Security.Cryptography;
using System.Text;

namespace LodgeCore.HardwareAgent.Security;

/// <summary>
/// Securely stores the Agent API Secret using Windows DPAPI.
/// Prevents the secret from sitting in plaintext in appsettings.json.
/// </summary>
public class CredentialStore
{
    public void SaveSecret(string secret)
    {
        var secretBytes = Encoding.UTF8.GetBytes(secret);
        var encrypted = ProtectedData.Protect(secretBytes, null, DataProtectionScope.LocalMachine);
        // Save to registry or local AppData
    }

    public string? LoadSecret()
    {
        // Load from registry or AppData
        // var decrypted = ProtectedData.Unprotect(encryptedBytes, null, DataProtectionScope.LocalMachine);
        // return Encoding.UTF8.GetString(decrypted);
        return null; // Stub
    }
}
