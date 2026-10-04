using Inkwell.Application.Auth.Dtos;
using Inkwell.Application.Common;
using Inkwell.Application.Posts.Mapping;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Auth;

public sealed class AuthService : IAuthService
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokens;
    private readonly IUnitOfWork _unitOfWork;

    public AuthService(IUserRepository users, IPasswordHasher passwordHasher, ITokenService tokens, IUnitOfWork unitOfWork)
    {
        _users = users;
        _passwordHasher = passwordHasher;
        _tokens = tokens;
        _unitOfWork = unitOfWork;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var handle = SlugGenerator.Generate(request.Handle);

        if (string.IsNullOrEmpty(handle)) throw new DomainException("Handle must contain at least one letter or digit.");
        if (await _users.EmailExistsAsync(email, ct)) throw new ConflictException("An account with that email already exists.");
        if (await _users.HandleExistsAsync(handle, ct)) throw new ConflictException($"The handle '{handle}' is taken.");

        var user = new User(email, handle, request.DisplayName, _passwordHasher.Hash(request.Password));

        await _users.AddAsync(user, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return BuildResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _users.GetByEmailAsync(request.Email.Trim().ToLowerInvariant(), ct);

        // Same message either way, so the endpoint cannot be used to enumerate registered emails.
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new DomainException("Invalid email or password.");

        return BuildResponse(user);
    }

    public async Task<CurrentUserDto> GetCurrentAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _users.GetByIdAsync(userId, ct) ?? throw new NotFoundException(nameof(User), userId);
        return user.ToCurrentUser();
    }

    private AuthResponse BuildResponse(User user)
    {
        var token = _tokens.Create(user);
        return new AuthResponse(token.Token, token.ExpiresAt, user.ToCurrentUser());
    }
}
