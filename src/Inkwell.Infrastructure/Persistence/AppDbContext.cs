using Inkwell.Domain.Entities;
using Inkwell.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Inkwell.Infrastructure.Persistence;

public class AppDbContext : DbContext, IUnitOfWork
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<PostTag> PostTags => Set<PostTag>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Clap> Claps => Set<Clap>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<UserFollow> UserFollows => Set<UserFollow>();
    public DbSet<TagFollow> TagFollows => Set<TagFollow>();
    public DbSet<PostRevision> PostRevisions => Set<PostRevision>();
    public DbSet<StoredImage> Images => Set<StoredImage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        if (Database.IsSqlite()) ApplySqliteDateTimeOffsetConversion(modelBuilder);

        base.OnModelCreating(modelBuilder);
    }

    /// <summary>
    /// SQLite has no native DateTimeOffset and refuses to ORDER BY one, which breaks every
    /// "newest first" query. Storing UTC ticks as an integer keeps ordering and comparison
    /// working in SQL. All timestamps in this model are UTC, so no offset information is lost.
    /// On Postgres this conversion is not applied and timestamptz is used directly.
    /// </summary>
    private static void ApplySqliteDateTimeOffsetConversion(ModelBuilder modelBuilder)
    {
        var converter = new ValueConverter<DateTimeOffset, long>(
            value => value.UtcTicks,
            ticks => new DateTimeOffset(ticks, TimeSpan.Zero));

        var nullableConverter = new ValueConverter<DateTimeOffset?, long?>(
            value => value == null ? null : value.Value.UtcTicks,
            ticks => ticks == null ? null : new DateTimeOffset(ticks.Value, TimeSpan.Zero));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset))
                {
                    property.SetValueConverter(converter);
                }
                else if (property.ClrType == typeof(DateTimeOffset?))
                {
                    property.SetValueConverter(nullableConverter);
                }
            }
        }
    }
}
