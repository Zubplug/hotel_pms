using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Auth;

/// <summary>
/// Stores and retrieves agent credentials (agentId + agentSecret) using
/// Windows Data Protection API (DPAPI) via the Windows Credential Manager.
/// 
/// Credentials are tied to the local machine and Windows user account —
/// they cannot be read on another machine or by another user.
/// </summary>
public sealed class AgentAuthenticator
{
    private const string CredentialTarget = "LodgeCoreAgent";
    private readonly ILogger<AgentAuthenticator> _logger;

    public AgentAuthenticator(ILogger<AgentAuthenticator> logger)
    {
        _logger = logger;
    }

    public record AgentCredential(string AgentId, string AgentSecret);

    /// <summary>Retrieve stored credentials from Windows Credential Manager.</summary>
    public AgentCredential? Load()
    {
        try
        {
            if (CredRead(CredentialTarget, CRED_TYPE_GENERIC, 0, out var credPtr) && credPtr != IntPtr.Zero)
            {
                var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
                CredFree(credPtr);

                if (cred.CredentialBlobSize > 0 && cred.CredentialBlob != IntPtr.Zero)
                {
                    var bytes = new byte[cred.CredentialBlobSize];
                    Marshal.Copy(cred.CredentialBlob, bytes, 0, bytes.Length);
                    var json = System.Text.Encoding.Unicode.GetString(bytes);
                    var stored = JsonSerializer.Deserialize<StoredCredential>(json);
                    if (stored is not null)
                        return new AgentCredential(stored.AgentId, stored.AgentSecret);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load credentials from Windows Credential Manager");
        }
        return null;
    }

    /// <summary>Save credentials to Windows Credential Manager (DPAPI-encrypted).</summary>
    public bool Save(string agentId, string agentSecret)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new StoredCredential(agentId, agentSecret));
            var blob = System.Text.Encoding.Unicode.GetBytes(payload);

            var cred = new CREDENTIAL
            {
                TargetName     = CredentialTarget,
                Type           = CRED_TYPE_GENERIC,
                Persist        = CRED_PERSIST_LOCAL_MACHINE,
                CredentialBlob = Marshal.AllocHGlobal(blob.Length),
                CredentialBlobSize = blob.Length,
                UserName       = agentId,
            };

            Marshal.Copy(blob, 0, cred.CredentialBlob, blob.Length);

            try
            {
                bool result = CredWrite(ref cred, 0);
                if (!result)
                    _logger.LogError("CredWrite failed with error {Error}", Marshal.GetLastWin32Error());
                return result;
            }
            finally
            {
                Marshal.FreeHGlobal(cred.CredentialBlob);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save credentials to Windows Credential Manager");
            return false;
        }
    }

    // ── Win32 P/Invoke (Credential Manager) ──────────────────────────────────

    private const uint CRED_TYPE_GENERIC      = 1;
    private const uint CRED_PERSIST_LOCAL_MACHINE = 2;

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, uint type, int flags, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string? Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string? TargetAlias;
        public string UserName;
    }

    private record StoredCredential(string AgentId, string AgentSecret);
}
