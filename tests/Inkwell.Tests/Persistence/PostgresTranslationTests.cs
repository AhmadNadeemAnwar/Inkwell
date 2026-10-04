using FluentAssertions;
using Inkwell.Domain.Common;
using Inkwell.Infrastructure.Persistence;
using Inkwell.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Net.Sockets;
using Xunit;

namespace Inkwell.Tests.Persistence;

/// <summary>
/// No Postgres server is available in tests, but EF Core translates LINQ to SQL before it opens
/// a connection. Pointing the repositories at an unreachable server therefore proves each query
/// translates for Npgsql: a translation bug surfaces as InvalidOperationException, whereas a
/// translatable query fails later with a connection error.
/// </summary>
public class PostgresTranslationTests : IDisposable
{
    private readonly AppDbContext _db = new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql("Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=1;Command Timeout=1")
        .Options);

    private static async Task AssertTranslatesAsync(Func<Task> query)
    {
        var failure = await Record.ExceptionAsync(query);
        failure.Should().NotBeNull("the database is deliberately unreachable");

        // Npgsql wraps connection failures in retry/transient exceptions, so look at the root
        // cause. A translation bug has no network error underneath it, and its root is EF's own
        // InvalidOperationException ("could not be translated", "Include after Select", ...).
        var root = failure!;
        while (root.InnerException is not null) root = root.InnerException;

        root.Should().Match<Exception>(
            e => e is SocketException || e is NpgsqlException || e is TimeoutException,
            "the query should translate and only fail when connecting, but the root cause was {0}: {1}",
            root.GetType().Name, root.Message);
    }

    [Theory]
    [InlineData(PostSort.Latest, null)]
    [InlineData(PostSort.Latest, "Postgres")]
    [InlineData(PostSort.Popular, "pool")]
    [InlineData(PostSort.Trending, null)]
    public Task Post_search_translates(PostSort sort, string? term) =>
        AssertTranslatesAsync(() => new PostRepository(_db).SearchAsync(new PostQuery
        {
            SearchTerm = term, Sort = sort, TagSlug = "engineering", AuthorHandle = "maya"
        }));

    [Fact]
    public Task Personal_feed_translates() =>
        AssertTranslatesAsync(() => new PostRepository(_db).GetPersonalFeedAsync(Guid.NewGuid(), 1, 20));

    [Fact]
    public Task Drafts_translate() =>
        AssertTranslatesAsync(() => new PostRepository(_db).GetDraftsAsync(Guid.NewGuid(), 1, 20));

    [Fact]
    public Task Bookmarks_translate() =>
        AssertTranslatesAsync(() => new PostRepository(_db).GetBookmarkedAsync(Guid.NewGuid(), 1, 20));

    [Fact]
    public Task Tag_suggestions_translate() =>
        AssertTranslatesAsync(() => new TagRepository(_db).SearchAsync("eng", 10));

    [Fact]
    public Task Popular_tags_translate() =>
        AssertTranslatesAsync(() => new TagRepository(_db).GetPopularAsync(10));

    [Fact]
    public Task Comment_threads_translate() =>
        AssertTranslatesAsync(() => new CommentRepository(_db).GetThreadAsync(Guid.NewGuid()));

    public void Dispose() => _db.Dispose();
}
