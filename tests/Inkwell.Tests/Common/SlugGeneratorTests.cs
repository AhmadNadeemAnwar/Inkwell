using FluentAssertions;
using Inkwell.Application.Common;
using Xunit;

namespace Inkwell.Tests.Common;

public class SlugGeneratorTests
{
    [Theory]
    [InlineData("Hello World", "hello-world")]
    [InlineData("  Trim me  ", "trim-me")]
    [InlineData("Punctuation, everywhere!", "punctuation-everywhere")]
    [InlineData("Multiple   spaces", "multiple-spaces")]
    [InlineData("Already-slugged", "already-slugged")]
    [InlineData("Numbers 123 stay", "numbers-123-stay")]
    public void Generate_produces_url_safe_slugs(string input, string expected) =>
        SlugGenerator.Generate(input).Should().Be(expected);

    [Fact]
    public void Generate_strips_accents_so_equivalent_titles_collapse() =>
        SlugGenerator.Generate("Café résumé").Should().Be("cafe-resume");

    [Fact]
    public void Generate_returns_empty_for_input_with_no_alphanumerics() =>
        SlugGenerator.Generate("!!! ???").Should().BeEmpty();

    [Fact]
    public void Generate_truncates_long_titles_without_leaving_a_trailing_dash()
    {
        var slug = SlugGenerator.Generate(string.Join(' ', Enumerable.Repeat("word", 40)));

        slug.Length.Should().BeLessThanOrEqualTo(80);
        slug.Should().NotEndWith("-");
    }

    [Fact]
    public void WithSuffix_keeps_the_base_and_appends_a_discriminator()
    {
        var suffixed = SlugGenerator.WithSuffix("my-post");

        suffixed.Should().StartWith("my-post-");
        suffixed.Should().NotBe(SlugGenerator.WithSuffix("my-post"));
    }
}
