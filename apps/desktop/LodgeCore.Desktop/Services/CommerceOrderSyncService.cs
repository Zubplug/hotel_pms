using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Background service that polls the LodgeCore cloud POS bridge endpoint every
/// 30 seconds and injects new online Food Commerce orders into the local POS.
///
/// Design principles (mirror KotPrintService):
///   • This is the ONLY code path that creates <see cref="LocalPosOrder"/> rows
///     for online (web/app) orders. Never let the UI touch this directly.
///   • Idempotency: CommerceSyncEvent.id is the primary key of LocalCommerceInboundOrder.
///     Duplicate acknowledgements are silently ignored.
///   • Orders are injected as LocalPosOrder with <c>OrderType = "ONLINE_WEB"</c>
///     and <c>Notes</c> containing the cloud order reference + customer name.
///     The existing KotPrintService will pick up the KOT automatically.
///   • If the terminal is offline or the POS bridge API returns non-2xx, the
///     service retries on the next poll. Exponential back-off is applied after 3
///     consecutive failures (consistent with <see cref="SyncEngine"/> pattern).
///   • The service is only active when the terminal has a Food Commerce package
///     entitlement in its cached <c>EntitlementsJson</c>.
/// </summary>
public class CommerceOrderSyncService : BackgroundService
{
    private const int PollIntervalSeconds = 30;
    private const int MaxInjectionRetries = 5;

    private readonly IServiceProvider _serviceProvider;
    private readonly HttpClient _httpClient;
    private readonly AuthManager _authManager;
    private readonly ILogger<CommerceOrderSyncService> _logger;

    private int _consecutiveFailures = 0;

    public CommerceOrderSyncService(
        IServiceProvider serviceProvider,
        HttpClient httpClient,
        AuthManager authManager,
        ILogger<CommerceOrderSyncService> logger)
    {
        _serviceProvider = serviceProvider;
        _httpClient = httpClient;
        _authManager = authManager;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CommerceOrderSyncService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAndInjectAsync(stoppingToken);
                _consecutiveFailures = 0;
                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _consecutiveFailures++;
                var backoff = Math.Min(300, PollIntervalSeconds * (int)Math.Pow(2, _consecutiveFailures - 1));
                _logger.LogError(ex, "CommerceOrderSyncService poll error (failure #{Count}). Backing off {Seconds}s.", _consecutiveFailures, backoff);
                await Task.Delay(TimeSpan.FromSeconds(backoff), stoppingToken);
            }
        }

        _logger.LogInformation("CommerceOrderSyncService stopped.");
    }

    // ─── Core poll cycle ─────────────────────────────────────────────────────

    private async Task PollAndInjectAsync(CancellationToken ct)
    {
        // 1. Gate: only run if the terminal has the Food Commerce add-on.
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var terminal = await db.PosTerminals.FirstOrDefaultAsync(ct);
        if (terminal == null) return;

        if (!HasFoodCommerceEntitlement(terminal.EntitlementsJson))
        {
            _logger.LogDebug("CommerceOrderSyncService: Food Commerce package not active on this terminal — skipping poll.");
            return;
        }

        // A terminal may be restaurant/bar capable without being assigned to
        // the active CommerceStore. Keep the assignment decision in the cloud
        // projection and do not pull or inject orders until it is enabled.
        if (!terminal.OnlineOrdersEnabled)
        {
            _logger.LogDebug("CommerceOrderSyncService: terminal {TerminalId} is not assigned to an active CommerceStore outlet — skipping poll.", terminal.Id);
            return;
        }

        // 2. Gate: need an authenticated session token.
        var token = await _authManager.GetAuthTokenAsync();
        if (string.IsNullOrWhiteSpace(token)) return;

        // 3. Use the outlet assigned to this terminal. Never select an arbitrary
        //    F&B outlet: that can route a web order to the wrong department.
        var property = await db.Properties.FirstOrDefaultAsync(ct);
        if (property == null) return;

        var outlet = await db.PosOutlets
            .Where(o => o.Id == terminal.OutletId && o.PropertyId == property.Id && o.IsActive)
            .FirstOrDefaultAsync(ct);

        if (outlet == null)
        {
            _logger.LogWarning("CommerceOrderSyncService: No active F&B outlet found for property {PropertyId}. Skipping.", property.Id);
            return;
        }

        // 4. Collect already-acknowledged sync event IDs so we don't re-process.
        var knownIds = (await db.CommerceInboundOrders
            .Select(o => o.SyncEventId)
            .ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // 5. Pull pending events from the cloud POS bridge.
        var events = await PullFromCloudAsync(token, outlet.Id, ct);
        if (events == null || events.Count == 0) return;

        _logger.LogInformation("CommerceOrderSyncService: Received {Count} event(s) from bridge.", events.Count);

        // 6. Persist received events (idempotent insert).
        var newEvents = events.Where(e => !knownIds.Contains(e.SyncEventId)).ToList();
        if (newEvents.Count > 0)
        {
            foreach (var ev in newEvents)
            {
                db.CommerceInboundOrders.Add(new LocalCommerceInboundOrder
                {
                    SyncEventId     = ev.SyncEventId,
                    CommerceOrderId = ev.OrderId,
                    OrderRef        = ev.OrderRef,
                    OrderType       = ev.OrderType,
                    CustomerName    = ev.CustomerName ?? "Guest",
                    CustomerPhone   = ev.CustomerPhone,
                    ItemsJson       = JsonSerializer.Serialize(ev.Items),
                    TotalAmount     = ev.TotalAmount,
                    InjectionStatus = "PENDING",
                    ReceivedAt      = DateTime.UtcNow,
                });
            }
            await db.SaveChangesAsync(ct);
        }

        // 7. Inject PENDING orders into the local POS.
        var pending = await db.CommerceInboundOrders
            .Where(o => o.InjectionStatus == "PENDING" && o.RetryCount < MaxInjectionRetries)
            .ToListAsync(ct);

        foreach (var inbound in pending)
        {
            await InjectOrderAsync(db, inbound, outlet, property, ct);
        }

        // 8. Acknowledge successfully injected orders back to the cloud.
        var injected = await db.CommerceInboundOrders
            .Where(o => o.InjectionStatus == "INJECTED" && o.CloudAcknowledgedAt == null)
            .Select(o => new InjectedOrder(o.SyncEventId, o.LocalPosOrderId))
            .ToListAsync(ct);

        if (injected.Count > 0)
        {
            await AcknowledgeAsync(token, outlet.Id, injected, ct);
        }
    }

    // ─── Cloud pull ───────────────────────────────────────────────────────────

    private async Task<List<PosBridgeEvent>?> PullFromCloudAsync(string token, string outletId, CancellationToken ct)
    {
        try
        {
            // The API base address already ends with /api/v1/
            var request = new HttpRequestMessage(HttpMethod.Post, "../commerce/pos-bridge/sync");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(
                JsonSerializer.Serialize(new { action = "pull", outletId, limit = 10 }),
                Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("CommerceOrderSyncService: POS bridge returned {Status}.", response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<PosBridgeResponse>(cancellationToken: ct);
            return body?.Data?.Events;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "CommerceOrderSyncService: Failed to pull from cloud bridge.");
            return null;
        }
    }

    // ─── Cloud acknowledge ────────────────────────────────────────────────────

    private async Task AcknowledgeAsync(string token, string outletId, List<InjectedOrder> injected, CancellationToken ct)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "../commerce/pos-bridge/sync");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    action = "acknowledge",
                    outletId,
                    results = injected.Select(item => new
                    {
                        syncEventId = item.SyncEventId,
                        idempotencyKey = string.Empty,
                        success = true,
                        localPosOrderId = item.LocalPosOrderId,
                    }),
                }),
                Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("CommerceOrderSyncService: Acknowledged {Count} event(s).", injected.Count);

                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
                var rows = await db.CommerceInboundOrders
                    .Where(o => injected.Select(item => item.SyncEventId).Contains(o.SyncEventId) && o.InjectionStatus == "INJECTED")
                    .ToListAsync(ct);

                foreach (var row in rows)
                    row.CloudAcknowledgedAt = DateTime.UtcNow;

                await db.SaveChangesAsync(ct);
            }
            else
            {
                _logger.LogWarning("CommerceOrderSyncService: Acknowledge call returned {Status} — will retry next poll.", response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "CommerceOrderSyncService: Acknowledge call failed — will retry next poll.");
        }
    }

    // ─── Local POS injection ──────────────────────────────────────────────────

    private sealed record InjectedOrder(string SyncEventId, string? LocalPosOrderId);

    private async Task InjectOrderAsync(
        LocalDbContext db,
        LocalCommerceInboundOrder inbound,
        LocalPosOutlet outlet,
        LocalProperty property,
        CancellationToken ct)
    {
        try
        {
            // Deserialise the order items payload.
            var items = JsonSerializer.Deserialize<List<PosBridgeItem>>(inbound.ItemsJson)
                        ?? new List<PosBridgeItem>();

            // Build a stable local order number: "WEB-" + last 6 chars of cloud orderRef.
            var orderNumber = $"WEB-{inbound.OrderRef.Replace("WEB-", "").PadLeft(5, '0')}";
            var orderId     = Guid.NewGuid().ToString();
            var notes       = $"[Online Order] {inbound.OrderRef} | {inbound.CustomerName}" +
                              (string.IsNullOrWhiteSpace(inbound.CustomerPhone) ? "" : $" | {inbound.CustomerPhone}") +
                              $" | Type: {inbound.OrderType}";

            // ── Build LocalPosOrder ──
            var posOrder = new LocalPosOrder
            {
                Id           = orderId,
                PropertyId   = property.Id,
                OutletId     = outlet.Id,
                SessionId    = null,          // Online orders don't require an open shift
                OrderNumber  = orderNumber,
                Status       = "OPEN",
                BusinessDate = DateTime.UtcNow.Date,
                OrderType    = "ONLINE_WEB",
                PaymentStatus = "PAID",        // Payment was collected online
                Notes        = notes,
                GuestCount   = 1,
                CreatedAt    = DateTime.UtcNow,
                UpdatedAt    = DateTime.UtcNow,
                DisplayName  = $"{inbound.CustomerName} (Online)",
            };

            // ── Build order items ──
            var orderItems = new List<LocalPosOrderItem>();
            decimal subtotal = 0;

            foreach (var item in items)
            {
                var itemId  = Guid.NewGuid().ToString();
                var total   = item.UnitPrice * item.Quantity;
                subtotal   += total;

                orderItems.Add(new LocalPosOrderItem
                {
                    Id          = itemId,
                    OrderId     = orderId,
                    ProductId   = item.ProductId,
                    ProductName = item.ProductName,
                    Quantity    = item.Quantity,
                    UnitPrice   = item.UnitPrice,
                    Total       = total,
                    Subtotal    = total,
                    TaxRate     = 0,
                    TaxAmount   = 0,
                    Discount    = 0,
                    CreatedAt   = DateTime.UtcNow,
                    KitchenStatus = "PENDING",
                });

            }

            // Resolve the production station from the locally synced POS
            // catalog. Online orders can contain both kitchen and bar items.
            var productIds = orderItems
                .Where(item => !string.IsNullOrWhiteSpace(item.ProductId))
                .Select(item => item.ProductId!)
                .Distinct()
                .ToList();
            var products = await db.PosProducts
                .Where(product => productIds.Contains(product.Id)
                    && product.PropertyId == property.Id
                    && product.IsActive)
                .ToListAsync(ct);
            var categoryIds = products.Select(product => product.CategoryId).Distinct().ToList();
            var categories = await db.ProductCategories
                .Where(category => categoryIds.Contains(category.Id)
                    && category.OutletId == outlet.Id
                    && category.IsActive)
                .ToDictionaryAsync(category => category.Id, ct);
            var productMap = products.ToDictionary(product => product.Id);

            string ResolveStation(LocalPosOrderItem item)
            {
                if (string.IsNullOrWhiteSpace(item.ProductId)
                    || !productMap.TryGetValue(item.ProductId, out var product))
                {
                    throw new InvalidOperationException(
                        $"Online product '{item.ProductName}' is not linked to an active local POS product.");
                }

                var station = product.ProductionStation;
                if (string.IsNullOrWhiteSpace(station)
                    && categories.TryGetValue(product.CategoryId, out var category))
                {
                    station = category.ProductionStation;
                }

                station = station?.Trim().ToUpperInvariant();
                if (station is not ("KITCHEN" or "BAR" or "DIRECT" or "NONE"))
                {
                    throw new InvalidOperationException(
                        $"Online product '{item.ProductName}' has no valid production station. Configure KITCHEN, BAR, DIRECT, or NONE.");
                }

                return station;
            }

            var stationGroups = orderItems.GroupBy(ResolveStation).ToList();

            posOrder.Subtotal = subtotal;
            posOrder.Total    = inbound.TotalAmount > 0 ? inbound.TotalAmount : subtotal;
            posOrder.TaxAmount = 0;
            posOrder.ServiceCharge = 0;

            // ── Build station-specific KOTs ──
            var kots = new List<LocalPosKot>();
            foreach (var stationGroup in stationGroups)
            {
                var station = stationGroup.Key;
                var requiresProductionTicket = station is "KITCHEN" or "BAR";
                var firedAt = DateTime.UtcNow;

                foreach (var item in stationGroup)
                {
                    item.KitchenStatus = requiresProductionTicket ? "PENDING" : "DIRECT";
                    item.SentToKitchenAt = firedAt;
                }

                if (!requiresProductionTicket) continue;

                var kotId = Guid.NewGuid().ToString();
                var kot = new LocalPosKot
                {
                    Id               = kotId,
                    OrderId          = orderId,
                    OutletId         = outlet.Id,
                    OrderNumber      = orderNumber,
                    KotNumber        = $"{orderNumber}-{station}",
                    Status           = "PENDING",
                    PrintStatus      = "QUEUED",         // KotPrintService routes by station
                    ProductionStation = station,
                    BusinessDate     = DateTime.UtcNow.Date,
                    CreatedAt        = firedAt,
                    FiredAt          = firedAt,
                    ItemIdsJson      = JsonSerializer.Serialize(stationGroup.Select(item => item.Id)),
                    DeviceId         = "ONLINE_COMMERCE",
                    CreatedBy        = "commerce-sync",
                    ServerName       = inbound.CustomerName,
                    TableNumber      = $"[{inbound.OrderType}]",
                };

                foreach (var item in stationGroup)
                    item.KotId = kot.Id;

                kots.Add(kot);
            }


            // ── Persist ──
            db.PosOrders.Add(posOrder);
            db.PosOrderItems.AddRange(orderItems);
            db.PosKots.AddRange(kots);

            inbound.LocalPosOrderId   = orderId;
            inbound.LocalKotIdsJson   = JsonSerializer.Serialize(kots.Select(kot => kot.Id).ToList());
            inbound.InjectionStatus   = "INJECTED";
            inbound.InjectedAt        = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "CommerceOrderSyncService: Injected online order {OrderRef} → LocalPosOrder {PosOrderId} with {KotCount} production KOT(s).",
                inbound.OrderRef, orderId, kots.Count);
        }
        catch (Exception ex)
        {
            inbound.RetryCount++;
            inbound.LastError = ex.Message[..Math.Min(500, ex.Message.Length)];
            if (inbound.RetryCount >= MaxInjectionRetries)
                inbound.InjectionStatus = "FAILED";

            _logger.LogError(ex,
                "CommerceOrderSyncService: Failed to inject order {OrderRef} (attempt {Attempt}/{Max}).",
                inbound.OrderRef, inbound.RetryCount, MaxInjectionRetries);

            await db.SaveChangesAsync(ct);
        }
    }

    // ─── Entitlement check ────────────────────────────────────────────────────

    private static bool HasFoodCommerceEntitlement(string? entitlementsJson)
    {
        if (string.IsNullOrWhiteSpace(entitlementsJson)) return false;
        try
        {
            var arr = JsonSerializer.Deserialize<string[]>(entitlementsJson) ?? Array.Empty<string>();
            return arr.Contains("ADDON_FOOD_COMMERCE", StringComparer.OrdinalIgnoreCase)
                || arr.Contains("ADDON_FOOD_STANDALONE", StringComparer.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────

    private sealed class PosBridgeResponse
    {
        [JsonPropertyName("data")]
        public PosBridgeData? Data { get; set; }
    }

    private sealed class PosBridgeData
    {
        [JsonPropertyName("events")]
        public List<PosBridgeEvent>? Events { get; set; }
    }

    private sealed class PosBridgeEvent
    {
        [JsonPropertyName("syncEventId")]
        public string SyncEventId { get; set; } = string.Empty;

        [JsonPropertyName("orderId")]
        public string OrderId { get; set; } = string.Empty;

        [JsonPropertyName("orderRef")]
        public string OrderRef { get; set; } = string.Empty;

        [JsonPropertyName("orderType")]
        public string OrderType { get; set; } = "PICKUP";

        [JsonPropertyName("customerName")]
        public string? CustomerName { get; set; }

        [JsonPropertyName("customerPhone")]
        public string? CustomerPhone { get; set; }

        [JsonPropertyName("totalAmount")]
        public decimal TotalAmount { get; set; }

        [JsonPropertyName("items")]
        public List<PosBridgeItem> Items { get; set; } = new();
    }

    private sealed class PosBridgeItem
    {
        [JsonPropertyName("productId")]
        public string? ProductId { get; set; }

        [JsonPropertyName("productName")]
        public string ProductName { get; set; } = string.Empty;

        [JsonPropertyName("quantity")]
        public decimal Quantity { get; set; }

        [JsonPropertyName("unitPrice")]
        public decimal UnitPrice { get; set; }

        [JsonPropertyName("notes")]
        public string? Notes { get; set; }
    }
}
