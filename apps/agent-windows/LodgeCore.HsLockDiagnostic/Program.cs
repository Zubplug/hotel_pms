using System;
using System.Threading.Tasks;
using LodgeCore.LockAgent.Hardware;
using Microsoft.Extensions.Logging;

namespace LodgeCore.HsLockDiagnostic;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("======================================");
        Console.WriteLine("    LodgeCore HS Lock Diagnostic     ");
        Console.WriteLine("======================================");
        Console.WriteLine();

        var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Debug);
        });

        ILockProvider provider = new HsLockProvider(loggerFactory.CreateLogger<HsLockProvider>());

        Console.WriteLine("[1] Initializing SDK (Type 4)...");
        var initResult = await provider.InitAsync(4, "COM3");
        if (!initResult.Success)
        {
            Console.WriteLine($"INIT FAILED: {initResult.VendorMessage} (Code: {initResult.ErrorCode})");
            return;
        }
        Console.WriteLine("INIT SUCCESS.");
        Console.WriteLine();

        Console.WriteLine("[2] Detecting Encoder & Card...");
        var pingResult = await provider.PingAsync();
        Console.WriteLine($"Encoder Present: {pingResult.EncoderPresent}");
        Console.WriteLine($"Card Present: {pingResult.CardPresent}");
        Console.WriteLine($"Raw Error Code: {pingResult.ErrorCode}");
        Console.WriteLine();

        if (!pingResult.CardPresent)
        {
            Console.WriteLine("No card detected. Please place a card on the encoder and try again.");
            await provider.ShutdownAsync();
            return;
        }

        Console.WriteLine("[3] Reading Card...");
        var readReq = new ReadRequest(WaitMs: 3000);
        var readResult = await provider.ReadGuestCardAsync(readReq);
        if (readResult.Success)
        {
            Console.WriteLine($"Card SNR: {readResult.CardSnr}");
            Console.WriteLine($"Room No: {readResult.RoomNo}");
            Console.WriteLine($"Check-In: {readResult.CheckIn}");
            Console.WriteLine($"Check-Out: {readResult.CheckOut}");
            Console.WriteLine($"Flags: {readResult.Flags}");
        }
        else
        {
            Console.WriteLine($"READ FAILED: {readResult.VendorMessage}");
        }
        Console.WriteLine();

        Console.WriteLine("[4] Encoding Test Card (Room 101)...");
        var encodeReq = new EncodeRequest(
            RoomNo: "1.1.101",
            CheckIn: DateTime.Now,
            CheckOut: DateTime.Now.AddDays(1),
            Flags: 8 // Assuming 8 is override
        );
        var encodeResult = await provider.EncodeGuestCardAsync(encodeReq);
        if (encodeResult.Success)
        {
            Console.WriteLine($"ENCODE SUCCESS. SNR: {encodeResult.CardSnr}");
        }
        else
        {
            Console.WriteLine($"ENCODE FAILED: {encodeResult.VendorMessage} (Code: {encodeResult.ErrorCode})");
        }
        Console.WriteLine();

        Console.WriteLine("[5] Reading Card Back...");
        readResult = await provider.ReadGuestCardAsync(readReq);
        if (readResult.Success)
        {
            Console.WriteLine($"Verified Room No: {readResult.RoomNo}");
        }
        Console.WriteLine();

        Console.WriteLine("[6] Cancelling Card...");
        var cancelReq = new CancelRequest(WaitMs: 3000);
        var cancelResult = await provider.CancelCardAsync(cancelReq);
        if (cancelResult.Success)
        {
            Console.WriteLine($"CANCEL SUCCESS. SNR: {cancelResult.CardSnr}");
        }
        else
        {
            Console.WriteLine($"CANCEL FAILED: {cancelResult.VendorMessage}");
        }
        Console.WriteLine();

        Console.WriteLine("[7] Shutting down SDK...");
        await provider.ShutdownAsync();
        Console.WriteLine("DONE.");
    }
}
