using System.Threading;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Serializes notification-cache merges and acknowledgements. Sync and UI
/// requests use separate EF DbContexts, so without this gate a sync can save
/// an older JSON snapshot after an acknowledgement and resurrect the alert.
/// </summary>
internal static class OfflineNotificationStore
{
    internal static readonly SemaphoreSlim Gate = new(1, 1);
}
