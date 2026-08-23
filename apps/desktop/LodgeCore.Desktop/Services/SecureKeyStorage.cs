using System;
using System.IO;
using System.Security.Cryptography;

namespace LodgeCore.Desktop.Services;

public static class SecureKeyStorage
{
    private static readonly string KeyFilePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "lodgecore_db_key.dat");

    public static string GetOrGenerateDatabaseKey()
    {
        if (File.Exists(KeyFilePath))
        {
            try
            {
                byte[] encryptedKey = File.ReadAllBytes(KeyFilePath);
                byte[] decryptedKey = ProtectedData.Unprotect(encryptedKey, null, DataProtectionScope.LocalMachine);
                return Convert.ToBase64String(decryptedKey);
            }
            catch
            {
                throw new CryptographicException("Failed to decrypt the local database key. Ensure this machine is authorized and the key was not copied from another system.");
            }
        }

        byte[] newKey = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(newKey);
        }

        byte[] protectedKey = ProtectedData.Protect(newKey, null, DataProtectionScope.LocalMachine);
        File.WriteAllBytes(KeyFilePath, protectedKey);

        return Convert.ToBase64String(newKey);
    }
}
