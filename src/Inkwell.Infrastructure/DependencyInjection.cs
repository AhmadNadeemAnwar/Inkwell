using Inkwell.Application.Common;
using Inkwell.Application.Portfolio;
using Inkwell.Infrastructure.Portfolio;
using Inkwell.Domain.Interfaces;
using Inkwell.Infrastructure.Persistence;
using Inkwell.Infrastructure.Persistence.Repositories;
using Inkwell.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Inkwell.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = DatabaseOptions.ParseProvider(configuration["Database:Provider"]);
        var connectionString = configuration.GetConnectionString("Default") ?? "Data Source=inkwell.db";

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider == DatabaseProvider.Postgres)
            {
                options.UseNpgsql(
                    DatabaseOptions.NormalisePostgresConnectionString(connectionString),
                    npgsql => npgsql.MigrationsAssembly(DatabaseOptions.PostgresMigrationsAssembly));
            }
            else
            {
                options.UseSqlite(connectionString);
            }
        });
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IPostRepository, PostRepository>();
        services.AddScoped<ITagRepository, TagRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();
        services.AddScoped<IEngagementRepository, EngagementRepository>();
        services.AddScoped<IAdminRepository, AdminRepository>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();

        services.AddSingleton<ILoginAttemptTracker, InMemoryLoginAttemptTracker>();

        services.Configure<PortfolioOptions>(configuration.GetSection(PortfolioOptions.SectionName));
        services.AddHttpClient<IPortfolioContentStore, GitHubPortfolioContentStore>();

        services.Configure<AdminOptions>(configuration.GetSection(AdminOptions.SectionName));
        services.AddSingleton<IAdminDirectory, ConfiguredAdminDirectory>();
        // Singleton: it remembers the last spent code, which must survive across requests.
        services.AddSingleton<ITotpVerifier, TotpVerifier>();

        services.Configure<TurnstileOptions>(configuration.GetSection(TurnstileOptions.SectionName));
        services.AddHttpClient<ITurnstileVerifier, TurnstileVerifier>();

        // On by default; switch off (Security:CheckPwnedPasswords=false) for offline development.
        if (configuration.GetValue("Security:CheckPwnedPasswords", true))
            services.AddHttpClient<IPwnedPasswordChecker, PwnedPasswordChecker>();
        else
            services.AddSingleton<IPwnedPasswordChecker, DisabledPwnedPasswordChecker>();

        return services;
    }
}
