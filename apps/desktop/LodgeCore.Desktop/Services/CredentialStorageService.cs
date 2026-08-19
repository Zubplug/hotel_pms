using System;
using System.Security.Cryptography;
using System.Text;

namespace LodgeCore.Desktop.Services;

public interface ICredentialStorageService
{
    void SaveCredential(string key, string secret);
    string? LoadCredential(string key);
    void DeleteCredential(string key);
}

public class DpapiCredentialStorageService : ICredentialStorageService
{
    public void SaveCredential(string key, string secret)
    {
        if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(secret)) return;

        // Use DPAPI to encrypt the string. 
        // DataProtectionScope.LocalMachine means any user on this machine can read it (good for a POS terminal).
        // If we want it restricted to the specific Windows user account, we use DataProtectionScope.CurrentUser.
        byte[] secretBytes = Encoding.UTF8.GetBytes(secret);
        byte[] encryptedBytes = ProtectedData.Protect(secretBytes, null, DataProtectionScope.LocalMachine);
        
        string base64Encrypted = Convert.ToBase64String(encryptedBytes);
        
        // Save to Windows Registry, or local file. 
        // For simplicity, we save it as a text file in the AppData folder.
        string path = GetFilePath(key);
        System.IO.File.WriteAllText(path, base64Encrypted);
    }

    public string? LoadCredential(string key)
    {
        string path = GetFilePath(key);
        if (!System.IO.File.Exists(path)) return null;

        try
        {
            string base64Encrypted = System.IO.File.ReadAllText(path);
            byte[] encryptedBytes = Convert.FromBase64String(base64Encrypted);
            
            byte[] decryptedBytes = ProtectedData.Unprotect(encryptedBytes, null, DataProtectionScope.LocalMachine);
            return Encoding.UTF8.GetString(decryptedBytes);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to unprotect credential for key {key}: {ex.Message}");
            return null;
        }
    }

    public void DeleteCredential(string key)
    {
        string path = GetFilePath(key);
        if (System.IO.File.Exists(path))
        {
            System.IO.File.Delete(path);
        }
    }

    private string GetFilePath(string key)
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string folder = System.IO.Path.Combine(appData, "LodgeCoreDesktop", "Credentials");
        if (!System.IO.Directory.Exists(folder))
        {
            System.IO.Directory.CreateDirectory(folder);
        }
        
        // Clean the key for safe filename
        string safeKey = string.Join("_", key.Split(System.IO.Path.GetInvalidFileNameChars()));
        return System.IO.Path.Combine(folder, $"{safeKey}.dat");
    }
}
