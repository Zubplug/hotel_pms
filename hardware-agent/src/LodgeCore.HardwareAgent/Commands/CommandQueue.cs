using System.Threading.Channels;

namespace LodgeCore.HardwareAgent.Commands;

public class CommandQueue
{
    private readonly Channel<LockCommand> _channel;

    public CommandQueue()
    {
        // Unbounded channel for commands. In production, we bound this to prevent memory leaks.
        _channel = Channel.CreateUnbounded<LockCommand>();
    }

    public void Enqueue(LockCommand command)
    {
        _channel.Writer.TryWrite(command);
    }

    public IAsyncEnumerable<LockCommand> ReadAllAsync(CancellationToken cancellationToken)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }
}
