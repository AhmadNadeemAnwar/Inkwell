using Inkwell.Application.Auth.Dtos;

namespace Inkwell.Application.Auth;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<CurrentUserDto> GetCurrentAsync(Guid userId, CancellationToken ct = default);
}
