namespace Inkwell.Domain.Enums;

public enum PostStatus
{
    /// <summary>Visible only to its author.</summary>
    Draft = 0,
    /// <summary>Publicly listed, indexed, and searchable.</summary>
    Published = 1,
    /// <summary>Reachable by direct link but excluded from feeds and search.</summary>
    Unlisted = 2
}
