using FluentValidation;
using Inkwell.Application.Auth;
using Inkwell.Application.Comments;
using Inkwell.Application.Engagement;
using Inkwell.Application.Posts;
using Inkwell.Application.Tags;
using Inkwell.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Inkwell.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPostService, PostService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IEngagementService, EngagementService>();
        services.AddScoped<ITagService, TagService>();
        services.AddScoped<IUserService, UserService>();

        services.AddValidatorsFromAssemblyContaining<AuthService>();

        return services;
    }
}
