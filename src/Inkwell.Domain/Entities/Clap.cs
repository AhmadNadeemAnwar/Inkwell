using Inkwell.Domain.Exceptions;

namespace Inkwell.Domain.Entities;

/// <summary>
/// A reader's applause for a post. One row per user+post; <see cref="Count"/> accumulates
/// repeat claps up to <see cref="MaxPerUser"/> rather than creating duplicate rows.
/// </summary>
public class Clap
{
    public const int MaxPerUser = 50;

    public Guid PostId { get; private set; }
    public Post Post { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public int Count { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;

    private Clap() { }

    public Clap(Guid postId, Guid userId, int count = 1)
    {
        PostId = postId;
        UserId = userId;
        Count = Math.Clamp(count, 1, MaxPerUser);
    }

    /// <returns>The number of claps actually added after clamping to <see cref="MaxPerUser"/>.</returns>
    public int Add(int amount)
    {
        if (amount <= 0) throw new DomainException("Clap amount must be positive.");
        var newTotal = Math.Min(MaxPerUser, Count + amount);
        var delta = newTotal - Count;
        Count = newTotal;
        return delta;
    }
}
