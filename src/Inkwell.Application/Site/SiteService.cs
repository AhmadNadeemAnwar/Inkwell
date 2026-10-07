using FluentValidation;
using Inkwell.Application.Admin;
using Inkwell.Application.Common;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Site;

public sealed record CategoryDto(Guid Id, string Name, string Slug);

public sealed record CategoryWithCountDto(Guid Id, string Name, string Slug, int PostCount);

/// <summary>What the public site needs before it draws anything: how it should look and how posts are shelved.</summary>
/// <param name="SubscribeEnabled">Whether the site can send email yet; the subscribe form is hidden until it can.</param>
public sealed record SiteDto(string Theme, IReadOnlyList<CategoryWithCountDto> Categories, bool SubscribeEnabled = false);

public sealed record SiteSettingsDto(string Theme, IReadOnlyList<string> AvailableThemes);

public sealed record UpdateSiteSettingsRequest(string Theme);

public sealed record SaveCategoryRequest(string Name);

public sealed class SaveCategoryRequestValidator : AbstractValidator<SaveCategoryRequest>
{
    public SaveCategoryRequestValidator() =>
        RuleFor(x => x.Name).NotEmpty().WithMessage("Category name is required.").MaximumLength(Category.MaxNameLength);
}

public interface ISiteService
{
    Task<SiteDto> GetPublicAsync(CancellationToken ct = default);

    Task<SiteSettingsDto> GetSettingsAsync(CancellationToken ct = default);
    Task<SiteSettingsDto> UpdateSettingsAsync(UpdateSiteSettingsRequest request, string admin, CancellationToken ct = default);

    Task<IReadOnlyList<CategoryWithCountDto>> GetCategoriesAsync(CancellationToken ct = default);
    Task<CategoryWithCountDto> CreateCategoryAsync(SaveCategoryRequest request, string admin, CancellationToken ct = default);
    Task<CategoryWithCountDto> RenameCategoryAsync(Guid id, SaveCategoryRequest request, string admin, CancellationToken ct = default);
    Task DeleteCategoryAsync(Guid id, string admin, CancellationToken ct = default);
}

/// <summary>The looks the public site can wear. The first is what a site that has never chosen gets.</summary>
public static class Themes
{
    public const string SettingKey = "theme";
    public const string Blue = "blue";
    public const string SeaGreen = "seagreen";

    public static readonly IReadOnlyList<string> All = [Blue, SeaGreen];

    public static string Normalise(string? value)
    {
        var wanted = value?.Trim().ToLowerInvariant();
        return All.FirstOrDefault(theme => theme == wanted)
            ?? throw new DomainException($"Theme must be one of: {string.Join(", ", All)}.");
    }

    /// <summary>A stored value this version does not know (left by a newer or older one) falls back rather than breaking the site.</summary>
    public static string OrDefault(string? stored) => All.Contains(stored ?? string.Empty) ? stored! : Blue;
}

public sealed class SiteService : ISiteService
{
    /// <summary>Categories are tabs across the home page; past a dozen they stop being a way to browse.</summary>
    public const int MaxCategories = 12;

    private readonly ISiteRepository _site;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IActivityLog _activity;

    public SiteService(ISiteRepository site, IUnitOfWork unitOfWork, IActivityLog? activity = null)
    {
        _site = site;
        _unitOfWork = unitOfWork;
        _activity = activity ?? NoActivityLog.Instance;
    }

    public async Task<SiteDto> GetPublicAsync(CancellationToken ct = default) =>
        new(Themes.OrDefault(await _site.GetSettingAsync(Themes.SettingKey, ct)), await GetCategoriesAsync(ct));

    public async Task<SiteSettingsDto> GetSettingsAsync(CancellationToken ct = default) =>
        new(Themes.OrDefault(await _site.GetSettingAsync(Themes.SettingKey, ct)), Themes.All);

    public async Task<SiteSettingsDto> UpdateSettingsAsync(UpdateSiteSettingsRequest request, string admin, CancellationToken ct = default)
    {
        var theme = Themes.Normalise(request.Theme);
        var current = Themes.OrDefault(await _site.GetSettingAsync(Themes.SettingKey, ct));

        if (theme != current)
        {
            await _site.SetSettingAsync(Themes.SettingKey, theme, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            await _activity.RecordAsync(admin, Activity.ChangedTheme, $"{current} to {theme}", ct);
        }

        return new SiteSettingsDto(theme, Themes.All);
    }

    public async Task<IReadOnlyList<CategoryWithCountDto>> GetCategoriesAsync(CancellationToken ct = default) =>
        (await _site.GetCategoriesAsync(ct)).Select(row => ToDto(row.Category, row.PublishedPosts)).ToList();

    public async Task<CategoryWithCountDto> CreateCategoryAsync(SaveCategoryRequest request, string admin, CancellationToken ct = default)
    {
        if (await _site.CountCategoriesAsync(ct) >= MaxCategories)
            throw new DomainException($"There can be at most {MaxCategories} categories. Remove one before adding another.");

        var name = request.Name.Trim();
        if (await _site.CategoryNameExistsAsync(name, null, ct)) throw new ConflictException($"There is already a category called \"{name}\".");

        var slug = SlugGenerator.Generate(name);
        if (slug.Length == 0) throw new DomainException("A category name needs at least one letter or number.");
        // Two names can reduce to the same address ("AI & ML" and "AI ML"); the second gets a short code.
        if (await _site.CategorySlugExistsAsync(slug, ct)) slug = SlugGenerator.WithCode(slug);

        var category = new Category(name, slug, await _site.NextCategorySortOrderAsync(ct));
        await _site.AddCategoryAsync(category, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _activity.RecordAsync(admin, Activity.AddedCategory, category.Name, ct);
        return ToDto(category, 0);
    }

    public async Task<CategoryWithCountDto> RenameCategoryAsync(Guid id, SaveCategoryRequest request, string admin, CancellationToken ct = default)
    {
        var category = await _site.GetCategoryAsync(id, ct) ?? throw new NotFoundException(nameof(Category), id);
        var name = request.Name.Trim();
        if (await _site.CategoryNameExistsAsync(name, id, ct)) throw new ConflictException($"There is already a category called \"{name}\".");

        var previous = category.Name;
        category.Rename(name);
        await _unitOfWork.SaveChangesAsync(ct);

        if (previous != category.Name) await _activity.RecordAsync(admin, Activity.RenamedCategory, $"{previous} to {category.Name}", ct);

        var count = (await _site.GetCategoriesAsync(ct)).FirstOrDefault(row => row.Category.Id == id).PublishedPosts;
        return ToDto(category, count);
    }

    public async Task DeleteCategoryAsync(Guid id, string admin, CancellationToken ct = default)
    {
        var category = await _site.GetCategoryAsync(id, ct) ?? throw new NotFoundException(nameof(Category), id);

        // Posts on this shelf are kept; they simply stop having a category.
        _site.RemoveCategory(category);
        await _unitOfWork.SaveChangesAsync(ct);

        await _activity.RecordAsync(admin, Activity.DeletedCategory, category.Name, ct);
    }

    private static CategoryWithCountDto ToDto(Category category, int posts) => new(category.Id, category.Name, category.Slug, posts);
}
