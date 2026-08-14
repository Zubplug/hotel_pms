using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;

namespace LodgeCore.LockAgent
{
    public class Worker : BackgroundService
    {
        private readonly ILogger<Worker> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        
        // Settings that would normally come from appsettings.json
        private readonly string _pmsUrl = "http://localhost:3000/api/v1/hardware/commands";
        private readonly string _agentId = "DEV_AGENT_001"; // Should be a secure token/cert
        private readonly int _pollIntervalMs = 2000;

        public Worker(ILogger<Worker> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        public override async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("LodgeCore Lock Agent starting. Initializing SDK...");
            
            try 
            {
                // Initialize SDK (Type 4 = RF57, Type 5 = RF50)
                int initResult = LockSDK.TP_Configuration(4);
                if (initResult != 1) 
                {
                    _logger.LogWarning($"SDK Init returned {initResult}: {LockSDK.GetErrorMessage(initResult)}");
                }
                else 
                {
                    _logger.LogInformation("SDK Initialized successfully.");
                }
            }
            catch (Exception ex)
            {
                // In simulated environments this will throw DllNotFoundException
                _logger.LogWarning($"Failed to load SDK DLL. Running in simulated mode. Error: {ex.Message}");
            }
            
            await base.StartAsync(cancellationToken);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollForCommands(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error polling for commands.");
                }

                await Task.Delay(_pollIntervalMs, stoppingToken);
            }
        }

        private async Task PollForCommands(CancellationToken stoppingToken)
        {
            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _agentId);
            
            var response = await client.GetAsync(_pmsUrl, stoppingToken);
            if (!response.IsSuccessStatusCode) return;

            var content = await response.Content.ReadAsStringAsync(stoppingToken);
            var result = JsonDocument.Parse(content);
            var data = result.RootElement.GetProperty("data");
            
            if (data.TryGetProperty("command", out var cmd) && cmd.ValueKind != JsonValueKind.Null)
            {
                var commandId = cmd.GetProperty("id").GetString();
                var commandType = cmd.GetProperty("commandType").GetString();
                var payload = cmd.GetProperty("payload");

                _logger.LogInformation($"Received Command: {commandId} [{commandType}]");

                await ProcessCommand(client, commandId, commandType, payload, stoppingToken);
            }
        }

        private async Task ProcessCommand(HttpClient client, string commandId, string commandType, JsonElement payload, CancellationToken stoppingToken)
        {
            try 
            {
                if (commandType == "ENCODE")
                {
                    await UpdateCommandStatus(client, commandId, "PROCESSING", "WAITING_FOR_CARD");

                    string roomNo = payload.GetProperty("lockCode").GetString();
                    string checkinTime = payload.GetProperty("checkinTime").GetString();
                    string checkoutTime = payload.GetProperty("checkoutTime").GetString();
                    int iflags = payload.GetProperty("iflags").GetInt32();
                    int waitMs = payload.GetProperty("waitMs").GetInt32();

                    // Format dates to YYYY-MM-DD HH:mm:ss for the SDK
                    checkinTime = DateTime.Parse(checkinTime).ToString("yyyy-MM-dd HH:mm:ss");
                    checkoutTime = DateTime.Parse(checkoutTime).ToString("yyyy-MM-dd HH:mm:ss");

                    StringBuilder cardSnr = new StringBuilder(100);

                    _logger.LogInformation($"Please place card on encoder for room {roomNo}...");

                    int retCode = 1; 
                    try 
                    {
                        retCode = LockSDK.TP_MakeGuestCardEx2(cardSnr, roomNo, checkinTime, checkoutTime, iflags, waitMs);
                    }
                    catch (DllNotFoundException)
                    {
                        // Simulated wait and success if DLL is missing
                        await Task.Delay(2000, stoppingToken);
                        await UpdateCommandStatus(client, commandId, "PROCESSING", "CARD_DETECTED");
                        await Task.Delay(1000, stoppingToken);
                        await UpdateCommandStatus(client, commandId, "PROCESSING", "ENCODING");
                        await Task.Delay(500, stoppingToken);
                        await UpdateCommandStatus(client, commandId, "PROCESSING", "VERIFYING");
                        await Task.Delay(500, stoppingToken);
                        _logger.LogInformation("[SIMULATION] Card encoded successfully.");
                    }

                    if (retCode == 1)
                    {
                        await UpdateCommandStatus(client, commandId, "COMPLETED", "ACTIVE");
                        _logger.LogInformation("Card encoded successfully!");
                    }
                    else 
                    {
                        string errorMsg = LockSDK.GetErrorMessage(retCode);
                        await UpdateCommandStatus(client, commandId, "FAILED", "FAILED", retCode.ToString(), errorMsg);
                        _logger.LogError($"SDK Error: {errorMsg}");
                    }
                }
            }
            catch (Exception ex)
            {
                await UpdateCommandStatus(client, commandId, "FAILED", "FAILED", "EXCEPTION", ex.Message);
            }
        }

        private async Task UpdateCommandStatus(HttpClient client, string commandId, string status, string operationStatus, string errorCode = null, string errorMessage = null)
        {
            var updatePayload = new
            {
                status = status,
                operationStatus = operationStatus,
                errorCode = errorCode,
                errorMessage = errorMessage
            };

            var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
            await client.PatchAsync($"{_pmsUrl}/{commandId}", content);
        }
    }
}
