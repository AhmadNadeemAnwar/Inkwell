using Inkwell.Application.Common;
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

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();

        return services;
    }
}
