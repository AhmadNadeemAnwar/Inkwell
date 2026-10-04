using Inkwell.Domain.Entities;

namespace Inkwell.Application.Common;

/// <summary>Password hashing, kept behind an interface so the algorithm is an infrastructure concern.</summary>
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt);

public interface ITokenService
{
    AccessToken Create(User user);
}

/// <summary>The authenticated caller for the current request, resolved from the bearer token.</summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    bool IsAuthenticated { get; }

    /// <summary>Returns the caller's id, or throws if the request is anonymous.</summary>
    Guid RequireUserId();
}

/// <summary>Checks a password against known breach corpora. Implementations must fail open (return false) on any error.</summary>
public interface IPwnedPasswordChecker
{
    Task<bool> IsPwnedAsync(string password, CancellationToken ct = default);
}

/// <summary>Bot check for sign-up. When no secret is configured, <see cref="IsEnabled"/> is false and verification is skipped.</summary>
public interface ITurnstileVerifier
{
    bool IsEnabled { get; }
    Task<bool> VerifyAsync(string? token, CancellationToken ct = default);
}

/// <summary>Counts failed sign-ins per account, so a distributed attack cannot get around per-IP limits.</summary>
public interface ILoginAttemptTracker
{
    bool IsLockedOut(string key);
    void RecordFailure(string key);
    void Clear(string key);
}
