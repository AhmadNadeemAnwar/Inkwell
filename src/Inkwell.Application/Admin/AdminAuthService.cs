using Inkwell.Application.Admin.Dtos;
using Inkwell.Application.Common;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Inkwell.Application.Admin;

public interface IAdminAuthService
{
    Task<AdminSessionDto> LoginAsync(AdminLoginRequest request, CancellationToken ct = default);
}

/// <summary>
/// Admin sign-in needs three things at once: the password, an email on the admin list, and a
/// current authenticator code. All three are always checked and a failure reveals nothing about
/// which one was wrong.
/// </summary>
public sealed class AdminAuthService : IAdminAuthService
{
    private const string Failure = "Invalid email, password or code.";

    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwords;
    private readonly ITokenService _tokens;
    private readonly IAdminDirectory _admins;
    private readonly ITotpVerifier _totp;
    private readonly ILoginAttemptTracker _attempts;
    private readonly ILogger<AdminAuthService> _logger;

    public AdminAuthService(
        IUserRepository users,
        IPasswordHasher passwords,
        ITokenService tokens,
        IAdminDirectory admins,
        ITotpVerifier totp,
        ILoginAttemptTracker attempts,
        ILogger<AdminAuthService> logger)
    {
        _users = users;
        _passwords = passwords;
        _tokens = tokens;
        _admins = admins;
        _totp = totp;
        _attempts = attempts;
        _logger = logger;
    }

    public async Task<AdminSessionDto> LoginAsync(AdminLoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var lockKey = $"admin:{email}";

        if (_attempts.IsLockedOut(lockKey))
            throw new TooManyRequestsException("Too many failed attempts. Try again in a few minutes.");

        if (!_admins.IsConfigured)
        {
            _logger.LogError("Admin sign-in attempted but Admin:Emails and Admin:TotpSecret are not both configured");
            _attempts.RecordFailure(lockKey);
            throw new DomainException(Failure);
        }

        var user = await _users.GetByEmailAsync(email, ct);

        // Evaluate every factor unconditionally so neither timing nor the message says which one failed.
        // For an unknown email the password is checked against a real throwaway hash, so the response
        // takes as long as it would for a real account.
        var passwordOk = _passwords.Verify(request.Password, user?.PasswordHash ?? _passwords.DummyHash) && user is not null;
        var isAdmin = _admins.IsAdmin(email);
        var step = _totp.Verify(request.Code);

        if (!passwordOk || !isAdmin || step is null)
        {
            _attempts.RecordFailure(lockKey);
            _logger.LogWarning("Failed admin sign-in for {Email}", email);
            throw new DomainException(Failure);
        }

        _totp.Consume(step.Value);
        _attempts.Clear(lockKey);

        var token = _tokens.CreateAdminSession(user!);
        _logger.LogInformation("Admin {Email} signed in", email);
        return new AdminSessionDto(token.Token, token.ExpiresAt, user!.Email, user.DisplayName);
    }
}
