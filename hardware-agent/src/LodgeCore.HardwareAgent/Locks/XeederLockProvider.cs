using System;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace LodgeCore.HardwareAgent.Locks;

public class XeederTcpClient : IDisposable
{
    private readonly string _host;
    private readonly int _port;
    private readonly TimeSpan _connectTimeout;
    private readonly TimeSpan _commandTimeout;

    private const byte STX = 0x02;
    private const byte ETX = 0x03;

    public XeederTcpClient(string host, int port, TimeSpan connectTimeout, TimeSpan commandTimeout)
    {
        _host = host;
        _port = port;
        _connectTimeout = connectTimeout;
        _commandTimeout = commandTimeout;
    }

    public async Task<string> SendCommandAsync(string commandData, CancellationToken cancellationToken)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(_connectTimeout);

        using var client = new TcpClient();
        try
        {
            await client.ConnectAsync(_host, _port, timeoutCts.Token);
            
            using var stream = client.GetStream();
            stream.ReadTimeout = (int)_commandTimeout.TotalMilliseconds;
            stream.WriteTimeout = (int)_commandTimeout.TotalMilliseconds;

            var payload = new byte[commandData.Length + 2];
            payload[0] = STX;
            var bytes = Encoding.ASCII.GetBytes(commandData);
            Array.Copy(bytes, 0, payload, 1, bytes.Length);
            payload[payload.Length - 1] = ETX;

            using var commandCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            commandCts.CancelAfter(_commandTimeout);

            await stream.WriteAsync(payload, 0, payload.Length, commandCts.Token);

            var buffer = new byte[4096];
            int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, commandCts.Token);

            if (bytesRead > 0)
            {
                // Strict STX/ETX framing check
                int start = 0;
                int end = bytesRead;

                if (buffer[0] == STX)
                {
                    start = 1;
                }
                
                // Find ETX
                for (int i = start; i < bytesRead; i++)
                {
                    if (buffer[i] == ETX)
                    {
                        end = i;
                        break;
                    }
                }

                if (end > start)
                {
                    return Encoding.ASCII.GetString(buffer, start, end - start);
                }
            }
        }
        catch (OperationCanceledException)
        {
            throw new TimeoutException($"Xeeder TCP operation timed out.");
        }

        return string.Empty;
    }

    public void Dispose()
    {
    }
}

public class XeederLockProvider : ILockProvider
{
    private readonly ILogger<XeederLockProvider> _logger;
    private const string VendorId = "XEEDER";
    private readonly string _host;
    private readonly int _port;
    private readonly TimeSpan _connectTimeout;
    private readonly TimeSpan _commandTimeout;
    
    private const string RS = "|";

    public string VendorName => VendorId;

    public XeederLockProvider(
        ILogger<XeederLockProvider> logger, 
        string host = "127.0.0.1", 
        int port = 7800,
        int connectTimeoutMs = 3000,
        int commandTimeoutMs = 5000)
    {
        _logger = logger;
        _host = host;
        _port = port;
        _connectTimeout = TimeSpan.FromMilliseconds(connectTimeoutMs);
        _commandTimeout = TimeSpan.FromMilliseconds(commandTimeoutMs);
    }

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on Xeeder encoder...");
        
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(timeout);
        
        var startTime = DateTime.UtcNow;
        using var client = new XeederTcpClient(_host, _port, _connectTimeout, _commandTimeout);

        while (!linkedCts.Token.IsCancellationRequested)
        {
            try
            {
                string response = await client.SendCommandAsync("00000E", linkedCts.Token);
                // "000000" means success reading the card
                if (!string.IsNullOrEmpty(response) && response.StartsWith("000000"))
                {
                    _logger.LogInformation("Card detected by Xeeder Encoder.");
                    return true;
                }
            }
            catch
            {
                // Ignore transient TCP errors while polling
            }

            try 
            {
                await Task.Delay(500, linkedCts.Token);
            }
            catch (OperationCanceledException) 
            {
                break;
            }
        }
        return false;
    }

    public async Task<LockResult> EncodeCardAsync(string lockCode, DateTime checkInDate, DateTime checkOutDate, CancellationToken cancellationToken)
    {
        try
        {
            using var client = new XeederTcpClient(_host, _port, _connectTimeout, _commandTimeout);

            string startStr = checkInDate.ToString("yyyyMMddHHmm");
            string endStr = checkOutDate.ToString("yyyyMMddHHmm");
            
            // Format: 00000I|R101|T04|D200901141300|O200901171800
            string command = $"00000I{RS}R{lockCode}{RS}T04{RS}D{startStr}{RS}O{endStr}";
            
            string response = await client.SendCommandAsync(command, cancellationToken);

            if (string.IsNullOrEmpty(response))
            {
                 return LockResult.Fail("-1", "Empty response from Xeeder server", VendorId);
            }

            if (response.StartsWith("000000"))
            {
                return LockResult.Ok(VendorId);
            }
            
            string errCode = response.Length >= 6 ? response.Substring(4, 2) : "Unknown";
            return LockResult.Fail(errCode, GetErrorMessage(errCode), VendorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Xeeder encode failed");
            return LockResult.Fail("-1", ex.Message, VendorId);
        }
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var client = new XeederTcpClient(_host, _port, _connectTimeout, _commandTimeout);
            string response = await client.SendCommandAsync("00000E", cancellationToken);
            
            if (string.IsNullOrEmpty(response))
            {
                 return new DiagnosticResult { Success = false, ErrorMessage = "Empty response from server. Check that encoder is connected and server is running.", Vendor = VendorId };
            }

            if (response.StartsWith("000000"))
            {
                return new DiagnosticResult { Success = true, RawDataHex = response, Vendor = VendorId };
            }
            
            string errCode = response.Length >= 6 ? response.Substring(4, 2) : "Unknown";
            return new DiagnosticResult { Success = false, ErrorMessage = GetErrorMessage(errCode), Vendor = VendorId };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Xeeder diagnostic failed");
            return new DiagnosticResult { Success = false, ErrorMessage = $"Server unreachable: {ex.Message}", Vendor = VendorId };
        }
    }

    public async Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var client = new XeederTcpClient(_host, _port, _connectTimeout, _commandTimeout);
            string response = await client.SendCommandAsync("00000E", cancellationToken);
            
            if (string.IsNullOrEmpty(response))
            {
                return ReadCardResult.Fail("-1", "Empty response from server", VendorId);
            }

            if (response.Length >= 6 && response.Substring(4, 2) == "01")
            {
                return ReadCardResult.Fail("01", "No Card", VendorId);
            }
            
            if (response.Length >= 6 && response.Substring(4, 2) == "20")
            {
                return ReadCardResult.Blank(VendorId);
            }

            if (response.StartsWith("000000"))
            {
                // Format: 000000|R101|T04|D200901141300|O200901171800
                string[] parts = response.Split(new[] { RS }, StringSplitOptions.None);
                
                string roomNo = "";
                string checkIn = "";
                string checkOut = "";
                
                foreach (var part in parts)
                {
                    if (part.StartsWith("R")) roomNo = part.Substring(1);
                    else if (part.StartsWith("D")) checkIn = part.Substring(1);
                    else if (part.StartsWith("O")) checkOut = part.Substring(1);
                }
                
                return ReadCardResult.WithData(roomNo, "", checkIn, checkOut, VendorId);
            }

            string errCode = response.Length >= 6 ? response.Substring(4, 2) : "Unknown";
            return ReadCardResult.Fail(errCode, GetErrorMessage(errCode), VendorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Xeeder read failed");
            return ReadCardResult.Fail("-1", ex.Message, VendorId);
        }
    }

    public async Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var client = new XeederTcpClient(_host, _port, _connectTimeout, _commandTimeout);
            string response = await client.SendCommandAsync("00000B", cancellationToken);

            if (string.IsNullOrEmpty(response))
            {
                return LockResult.Fail("-1", "Empty response from server", VendorId);
            }

            if (response.StartsWith("000000"))
            {
                return LockResult.Ok(VendorId);
            }
            
            string errCode = response.Length >= 6 ? response.Substring(4, 2) : "Unknown";
            return LockResult.Fail(errCode, GetErrorMessage(errCode), VendorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Xeeder cancel failed");
            return LockResult.Fail("-1", ex.Message, VendorId);
        }
    }

    public Task<LockResult> EncodeMasterCardAsync(DateTime? startDate, DateTime? endDate, CancellationToken cancellationToken)
    {
        return Task.FromResult(LockResult.Fail("-1", "Master Card encoding is only implemented for Deluns", VendorId));
    }

    private string GetErrorMessage(string code)
    {
        return code switch
        {
            "00" => "ok",
            "01" => "No card!",
            "02" => "No encoder found",
            "03" => "Invalid card",
            "04" => "Card type error",
            "05" => "Card read/write error",
            "06" => "Com Port is not open",
            "07" => "Read Query card ok",
            "08" => "Invalid parameter",
            "09" => "Operating not support",
            "10" => "Other error",
            "11" => "Port is in using",
            "12" => "Communication error",
            "13" => "Card is not empty, revoke it firstly",
            "14" => "Failed! Card Encryption is unknown",
            "15" => "Operating failed",
            "16" => "Unknown error",
            "17" => "The room is occupied",
            "18" => "Invalid room number",
            "20" => "The card is blank card",
            _ => $"Unknown error {code}"
        };
    }
}
