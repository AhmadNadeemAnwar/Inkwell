using FluentAssertions;
using Inkwell.Application.Engagement;
using Inkwell.Application.Posts;
using Inkwell.Application.Posts.Dtos;
using Inkwell.Domain.Entities;
using Xunit;

namespace Inkwell.Tests.Engagement;

public class EngagementServiceTests : IDisposable
{
    private readonly TestDatabase _fixture = new();
    private readonly PostService _posts;
    private readonly EngagementService _engagement;

    public EngagementServiceTests()
    {
        _posts = new PostService(_fixture.Posts, _fixture.Tags, _fixture.Engagement, _fixture.Db);
        _engagement = new EngagementService(_fixture.Engagement, _fixture.Posts, _fixture.Users, _fixture.Tags, _fixture.Db);
    }

    private async Task<(Guid PostId, User Author)> PublishedPostAsync()
    {
        var author = await _fixture.AddUserAsync("author");
        var draft = await _posts.CreateDraftAsync(
            new CreatePostRequest("A post", null, TestDatabase.Document("Body text here."), null, []),
            author.Id);

        await _posts.PublishAsync(draft.Id, author.Id);
        return (draft.Id, author);
    }

    [Fact]
    public async Task Repeated_claps_from_one_reader_accumulate_on_a_single_row()
    {
        var (postId, _) = await PublishedPostAsync();
        var reader = await _fixture.AddUserAsync("reader");

        await _engagement.ClapAsync(postId, reader.Id, 3);
        var result = await _engagement.ClapAsync(postId, reader.Id, 4);

        result.YourClapCount.Should().Be(7);
        result.PostClapCount.Should().Be(7);
        _fixture.Db.Claps.Count(c => c.PostId == postId).Should().Be(1);
    }

    [Fact]
    public async Task The_post_total_never_exceeds_the_sum_of_capped_per_reader_claps()
    {
        var (postId, _) = await PublishedPostAsync();
        var reader = await _fixture.AddUserAsync("reader");

        await _engagement.ClapAsync(postId, reader.Id, Clap.MaxPerUser);
        var result = await _engagement.ClapAsync(postId, reader.Id, 25);

        result.YourClapCount.Should().Be(Clap.MaxPerUser);
        result.PostClapCount.Should().Be(Clap.MaxPerUser);
    }

    [Fact]
    public async Task Claps_from_different_readers_are_counted_separately()
    {
        var (postId, _) = await PublishedPostAsync();
        var first = await _fixture.AddUserAsync("first");
        var second = await _fixture.AddUserAsync("second");

        await _engagement.ClapAsync(postId, first.Id, 2);
        var result = await _engagement.ClapAsync(postId, second.Id, 3);

        result.YourClapCount.Should().Be(3);
        result.PostClapCount.Should().Be(5);
    }

    [Fact]
    public async Task Bookmarking_toggles_on_and_off()
    {
        var (postId, _) = await PublishedPostAsync();
        var reader = await _fixture.AddUserAsync("reader");

        (await _engagement.ToggleBookmarkAsync(postId, reader.Id)).IsActive.Should().BeTrue();
        (await _engagement.ToggleBookmarkAsync(postId, reader.Id)).IsActive.Should().BeFalse();

        _fixture.Db.Bookmarks.Count().Should().Be(0);
    }

    [Fact]
    public async Task Bookmarked_posts_come_back_newest_saved_first()
    {
        var author = await _fixture.AddUserAsync("author");
        var reader = await _fixture.AddUserAsync("reader");

        var first = await _posts.CreateDraftAsync(
            new CreatePostRequest("First", null, TestDatabase.Document("Body one."), null, []), author.Id);
        await _posts.PublishAsync(first.Id, author.Id);

        var second = await _posts.CreateDraftAsync(
            new CreatePostRequest("Second", null, TestDatabase.Document("Body two."), null, []), author.Id);
        await _posts.PublishAsync(second.Id, author.Id);

        await _engagement.ToggleBookmarkAsync(first.Id, reader.Id);
        await Task.Delay(5);
        await _engagement.ToggleBookmarkAsync(second.Id, reader.Id);

        var saved = await _posts.GetBookmarksAsync(reader.Id, 1, 20);

        saved.Items.Select(p => p.Title).Should().Equal("Second", "First");
    }

    [Fact]
    public async Task Following_a_writer_toggles_and_fills_the_personal_feed()
    {
        var (postId, author) = await PublishedPostAsync();
        var reader = await _fixture.AddUserAsync("reader");

        (await _posts.GetPersonalFeedAsync(reader.Id, 1, 20)).TotalCount.Should().Be(0);

        var followed = await _engagement.ToggleFollowUserAsync(author.Handle, reader.Id);
        followed.IsActive.Should().BeTrue();

        var feed = await _posts.GetPersonalFeedAsync(reader.Id, 1, 20);
        feed.Items.Single().Id.Should().Be(postId);

        await _engagement.ToggleFollowUserAsync(author.Handle, reader.Id);
        (await _posts.GetPersonalFeedAsync(reader.Id, 1, 20)).TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Following_a_topic_also_fills_the_personal_feed()
    {
        var author = await _fixture.AddUserAsync("author");
        var reader = await _fixture.AddUserAsync("reader");

        var draft = await _posts.CreateDraftAsync(
            new CreatePostRequest("Tagged", null, TestDatabase.Document("Body."), null, ["Engineering"]), author.Id);
        await _posts.PublishAsync(draft.Id, author.Id);

        await _engagement.ToggleFollowTagAsync("engineering", reader.Id);

        var feed = await _posts.GetPersonalFeedAsync(reader.Id, 1, 20);
        feed.Items.Single().Title.Should().Be("Tagged");
    }

    public void Dispose() => _fixture.Dispose();
}
