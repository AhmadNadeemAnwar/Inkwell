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
