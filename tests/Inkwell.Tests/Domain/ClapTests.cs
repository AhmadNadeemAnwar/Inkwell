using FluentAssertions;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Exceptions;
using Xunit;

namespace Inkwell.Tests.Domain;

public class ClapTests
{
    [Fact]
    public void Add_reports_how_many_claps_were_actually_applied()
    {
        var clap = new Clap(Guid.NewGuid(), Guid.NewGuid(), 1);

        clap.Add(4).Should().Be(4);
        clap.Count.Should().Be(5);
    }

    [Fact]
    public void Add_clamps_at_the_per_user_ceiling_and_reports_only_the_applied_delta()
    {
        var clap = new Clap(Guid.NewGuid(), Guid.NewGuid(), Clap.MaxPerUser - 2);

        var applied = clap.Add(10);

        applied.Should().Be(2);
        clap.Count.Should().Be(Clap.MaxPerUser);
    }

    [Fact]
    public void Adding_once_the_ceiling_is_reached_applies_nothing()
    {
        var clap = new Clap(Guid.NewGuid(), Guid.NewGuid(), Clap.MaxPerUser);

        clap.Add(5).Should().Be(0);
        clap.Count.Should().Be(Clap.MaxPerUser);
    }

    [Fact]
    public void Construction_clamps_an_oversized_initial_count() =>
        new Clap(Guid.NewGuid(), Guid.NewGuid(), 9999).Count.Should().Be(Clap.MaxPerUser);

    [Fact]
    public void Add_rejects_a_non_positive_amount()
    {
        var clap = new Clap(Guid.NewGuid(), Guid.NewGuid());

        var act = () => clap.Add(0);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Following_yourself_is_rejected()
    {
        var id = Guid.NewGuid();

        var act = () => new UserFollow(id, id);

        act.Should().Throw<DomainException>().WithMessage("*cannot follow yourself*");
    }
}
