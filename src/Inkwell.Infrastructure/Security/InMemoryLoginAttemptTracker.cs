using System.Collections.Concurrent;
using Inkwell.Application.Common;

namespace Inkwell.Infrastructure.Security;

/// <summary>
/// Sliding-window failure counter per account key. In memory is deliberate: one API instance serves
/// all traffic, and losing the counters on a restart only gives an attacker a fresh window, not access.
/// If the API is ever scaled out, move this behind a shared store.
/// </summary>
public sealed class InMemoryLoginAttemptTracker : ILoginAttemptTracker
{
    public const int MaxFailures = 10;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    /// <summary>Bounds memory when someone sprays random emails; expired entries are swept first.</summary>
    private const int MaxTrackedKeys = 20_000;

    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _failures = new();
    private readonly TimeProvider _time;

    public InMemoryLoginAttemptTracker(TimeProvider? time = null) => _time = time ?? TimeProvider.System;

    public bool IsLockedOut(string key)
    {
        if (!_failures.TryGetValue(key, out var queue)) return false;

        lock (queue)
        {
            Prune(queue);
            return queue.Count >= MaxFailures;
        }
    }

    public void RecordFailure(string key)
    {
        if (_failures.Count >= MaxTrackedKeys) SweepExpired();
        if (_failures.Count >= MaxTrackedKeys) return;

        var queue = _failures.GetOrAdd(key, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            Prune(queue);
            queue.Enqueue(_time.GetUtcNow());
        }
    }

    public void Clear(string key) => _failures.TryRemove(key, out _);

    private void Prune(Queue<DateTimeOffset> queue)
    {
        var cutoff = _time.GetUtcNow() - Window;
        while (queue.Count > 0 && queue.Peek() < cutoff) queue.Dequeue();
    }

    private void SweepExpired()
    {
        foreach (var (key, queue) in _failures)
        {
            lock (queue)
            {
                Prune(queue);
                if (queue.Count == 0) _failures.TryRemove(key, out _);
            }
        }
    }
}
