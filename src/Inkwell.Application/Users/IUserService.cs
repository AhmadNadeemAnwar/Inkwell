using Inkwell.Application.Auth.Dtos;
using Inkwell.Application.Users.Dtos;

namespace Inkwell.Application.Users;

public interface IUserService
{
    Task<ProfileDto> GetProfileAsync(string handle, Guid? viewerId, CancellationToken ct = default);
    Task<CurrentUserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
}
