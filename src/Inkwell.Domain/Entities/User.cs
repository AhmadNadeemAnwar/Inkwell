using Inkwell.Domain.Common;
using Inkwell.Domain.Exceptions;

namespace Inkwell.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; private set; } = null!;
    /// <summary>Public, URL-safe identity (e.g. "ada-lovelace"). Immutable once set.</summary>
    public string Handle { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public string? Bio { get; private set; }
    public string? AvatarUrl { get; private set; }
    public string? WebsiteUrl { get; private set; }

    public ICollection<Post> Posts { get; private set; } = new List<Post>();

    private User() { }

    public User(string email, string handle, string displayName, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new DomainException("Email is required.");
        if (string.IsNullOrWhiteSpace(handle)) throw new DomainException("Handle is required.");
        if (string.IsNullOrWhiteSpace(displayName)) throw new DomainException("Display name is required.");
        if (string.IsNullOrWhiteSpace(passwordHash)) throw new DomainException("Password hash is required.");

        Email = email.Trim().ToLowerInvariant();
        Handle = handle.Trim().ToLowerInvariant();
        DisplayName = displayName.Trim();
        PasswordHash = passwordHash;
    }

    public void UpdateProfile(string displayName, string? bio, string? avatarUrl, string? websiteUrl)
    {
        if (string.IsNullOrWhiteSpace(displayName)) throw new DomainException("Display name is required.");
        if (bio is { Length: > 300 }) throw new DomainException("Bio cannot exceed 300 characters.");

        DisplayName = displayName.Trim();
        Bio = string.IsNullOrWhiteSpace(bio) ? null : bio.Trim();
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
        WebsiteUrl = string.IsNullOrWhiteSpace(websiteUrl) ? null : websiteUrl.Trim();
        Touch();
    }

    public void SetPasswordHash(string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash)) throw new DomainException("Password hash is required.");
        PasswordHash = passwordHash;
        Touch();
    }
}
