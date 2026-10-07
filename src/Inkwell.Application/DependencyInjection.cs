using FluentValidation;
using Inkwell.Application.Admin;
using Inkwell.Application.Auth;
using Inkwell.Application.Comments;
using Inkwell.Application.Engagement;
using Inkwell.Application.Portfolio;
using Inkwell.Application.Images;
using Inkwell.Application.Posts;
using Inkwell.Application.Site;
using Inkwell.Application.Subscriptions;
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
        services.AddScoped<IReactionService, ReactionService>();
        services.AddScoped<ITagService, TagService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IAdminAuthService, AdminAuthService>();
        services.AddScoped<IPortfolioService, PortfolioService>();
        services.AddScoped<IImageService, ImageService>();
        services.AddScoped<IImageGenerationService, ImageGenerationService>();
        services.AddScoped<ISiteService, SiteService>();
        services.AddScoped<ISubscriptionService, SubscriptionService>();

        services.AddValidatorsFromAssemblyContaining<AuthService>();

        return services;
    }
}
