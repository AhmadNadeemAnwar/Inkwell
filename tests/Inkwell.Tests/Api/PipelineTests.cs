using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Inkwell.Api.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Inkwell.Tests.Api;

/// <summary>
/// Boots the real API in the Production configuration (what Render runs), against a throwaway SQLite
/// file, so the middleware pipeline is exercised end to end rather than assumed.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string AllowedOrigin = "https://inkwell.example.com";
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"inkwell-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("Jwt:Key", new string('k', 48));
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_dbPath}");
        builder.UseSetting("Security:CheckPwnedPasswords", "false");
        builder.UseSetting("Cors:AllowedOrigins:0", AllowedOrigin);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        foreach (var suffix in new[] { "", "-shm", "-wal" })
        {
            try { File.Delete(_dbPath + suffix); } catch (IOException) { }
        }
    }
}

public class PipelineTests : IClassFixture<ApiFactory>
{
    private static int _ipCounter = 10;
    private readonly HttpClient _client;

    public PipelineTests(ApiFactory factory) => _client = factory.CreateClient();

    /// <summary>Each test gets its own address so rate-limit buckets never bleed between tests.</summary>
    private static string NewIp() => $"203.0.113.{Interlocked.Increment(ref _ipCounter)}";

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, string ip, object? body = null, string? token = null, string? origin = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("CF-Connecting-IP", ip);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (origin is not null) request.Headers.Add("Origin", origin);
        if (body is not null) request.Content = JsonContent.Create(body);
        return _client.SendAsync(request);
    }

    private Task<HttpResponseMessage> Login(string email, string ip, string password = "wrong-password") =>
        Send(HttpMethod.Post, "/api/v1/auth/login", ip, new { email, password });

    private static object Registration(string handle, string password = "correct horse battery staple") =>
        new { email = $"{handle}@example.com", handle, displayName = "Test Writer", password };

    // ---- Rate limiting ------------------------------------------------------------------

    [Fact]
    public async Task Login_is_limited_per_client_address_using_the_trusted_header()
    {
        var ip = NewIp();

        // Different emails each time, so only the per-address limit can be responsible.
        for (var i = 0; i < 10; i++)
            (await Login($"person{i}@example.com", ip)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var limited = await Login("person11@example.com", ip);

        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        limited.Headers.RetryAfter.Should().NotBeNull("clients should be told when to retry");
        limited.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task One_clients_limit_does_not_affect_another_client()
    {
        var noisy = NewIp();
        for (var i = 0; i < 11; i++) await Login($"spray{i}@example.com", noisy);

        (await Login("someone@example.com", noisy)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await Login("someone@example.com", NewIp())).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Sign_up_is_limited_to_five_per_hour_per_address()
    {
        var ip = NewIp();

        for (var i = 0; i < 5; i++)
            (await Send(HttpMethod.Post, "/api/v1/auth/register", ip, Registration($"signup-limit-{ip.Replace('.', '-')}-{i}")))
                .StatusCode.Should().Be(HttpStatusCode.Created);

        (await Send(HttpMethod.Post, "/api/v1/auth/register", ip, Registration($"signup-limit-{ip.Replace('.', '-')}-6")))
            .StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Search_has_its_own_tighter_limit_that_does_not_block_ordinary_reading()
    {
        var ip = NewIp();

        for (var i = 0; i < 30; i++)
            (await Send(HttpMethod.Get, "/api/v1/posts?q=anything", ip)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await Send(HttpMethod.Get, "/api/v1/posts?q=anything", ip)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await Send(HttpMethod.Get, "/api/v1/posts", ip)).StatusCode.Should().Be(HttpStatusCode.OK, "browsing is a separate bucket");
    }

    [Fact]
    public async Task The_health_check_is_never_throttled()
    {
        var ip = NewIp();

        for (var i = 0; i < 320; i++)
            (await Send(HttpMethod.Get, "/health", ip)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task An_account_locks_after_repeated_failures_even_when_the_attacker_rotates_addresses()
    {
        const string email = "target@example.com";

        // A distributed attack: every attempt arrives from a new address, so no per-address limit trips.
        for (var i = 0; i < 10; i++)
            (await Login(email, NewIp())).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var locked = await Login(email, NewIp());

        locked.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await locked.Content.ReadAsStringAsync()).Should().Contain("Too many failed sign-in attempts");
    }

    // ---- Response headers ---------------------------------------------------------------

    [Fact]
    public async Task Api_responses_carry_defensive_headers()
    {
        var response = await Send(HttpMethod.Get, "/api/v1/posts", NewIp());

        response.Headers.GetValues("X-Content-Type-Options").Should().ContainSingle("nosniff");
        response.Headers.GetValues("X-Frame-Options").Should().ContainSingle("DENY");
        response.Headers.GetValues("Referrer-Policy").Should().ContainSingle("no-referrer");
        response.Headers.GetValues("Content-Security-Policy").Single().Should().Contain("default-src 'none'").And.Contain("frame-ancestors 'none'");
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
    }

    [Fact]
    public async Task Error_and_throttled_responses_carry_the_headers_too()
    {
        var ip = NewIp();
        for (var i = 0; i < 10; i++) await Login($"hdr{i}@example.com", ip);

        var throttled = await Login("hdr-final@example.com", ip);
        var notFound = await Send(HttpMethod.Get, "/api/v1/posts/does-not-exist", NewIp());

        throttled.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        throttled.Headers.Contains("X-Content-Type-Options").Should().BeTrue();
        notFound.StatusCode.Should().Be(HttpStatusCode.NotFound);
        notFound.Headers.Contains("X-Content-Type-Options").Should().BeTrue();
    }

    [Fact]
    public async Task Swagger_is_not_served_in_production() =>
        (await Send(HttpMethod.Get, "/swagger/v1/swagger.json", NewIp())).StatusCode.Should().Be(HttpStatusCode.NotFound);

    // ---- CORS ---------------------------------------------------------------------------

    [Fact]
    public async Task Only_the_configured_origin_is_granted_cross_origin_access()
    {
        var allowed = await Send(HttpMethod.Get, "/api/v1/posts", NewIp(), origin: ApiFactory.AllowedOrigin);
        var stranger = await Send(HttpMethod.Get, "/api/v1/posts", NewIp(), origin: "https://evil.example");

        allowed.Headers.GetValues("Access-Control-Allow-Origin").Should().ContainSingle(ApiFactory.AllowedOrigin);
        stranger.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
    }

    // ---- Account rules, through the real HTTP stack ------------------------------------

    [Fact]
    public async Task Weak_passwords_are_rejected_with_a_message_about_the_password()
    {
        var response = await Send(HttpMethod.Post, "/api/v1/auth/register", NewIp(), Registration("weak-pw", "password123"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("too common");
    }

    [Fact]
    public async Task Reserved_handles_are_rejected()
    {
        var response = await Send(HttpMethod.Post, "/api/v1/auth/register", NewIp(), Registration("admin"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("reserved");
    }

    [Fact]
    public async Task A_javascript_website_is_rejected_by_the_server()
    {
        var ip = NewIp();
        var register = await Send(HttpMethod.Post, "/api/v1/auth/register", ip, Registration($"urltest-{ip.Replace('.', '-')}"));
        register.StatusCode.Should().Be(HttpStatusCode.Created);
        var token = JsonDocument.Parse(await register.Content.ReadAsStringAsync()).RootElement.GetProperty("token").GetString();

        var bad = await Send(HttpMethod.Put, "/api/v1/users/me", ip, new
        {
            displayName = "Test Writer", bio = (string?)null, avatarUrl = (string?)null, websiteUrl = "javascript:alert(document.domain)"
        }, token);
        var good = await Send(HttpMethod.Put, "/api/v1/users/me", ip, new
        {
            displayName = "Test Writer", bio = (string?)null, avatarUrl = (string?)null, websiteUrl = "https://example.com"
        }, token);

        bad.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await bad.Content.ReadAsStringAsync()).Should().Contain("http");
        good.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Tokens_issued_by_the_api_last_one_day()
    {
        var ip = NewIp();
        var register = await Send(HttpMethod.Post, "/api/v1/auth/register", ip, Registration($"expiry-{ip.Replace('.', '-')}"));
        var expires = JsonDocument.Parse(await register.Content.ReadAsStringAsync()).RootElement.GetProperty("expiresAt").GetDateTimeOffset();

        (expires - DateTimeOffset.UtcNow).Should().BeCloseTo(TimeSpan.FromHours(24), TimeSpan.FromMinutes(5));
    }
}

public class ClientIpTests
{
    private static HttpContext Context(string remote, params (string Name, string Value)[] headers)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(remote);
        foreach (var (name, value) in headers) context.Request.Headers[name] = value;
        return context;
    }

    [Fact]
    public void A_trusted_header_identifies_the_real_visitor_behind_a_proxy() =>
        ClientIp.Resolve(Context("10.0.0.5", ("CF-Connecting-IP", "198.51.100.7")), ["CF-Connecting-IP"])
            .Should().Be("198.51.100.7");

    [Fact]
    public void Headers_are_tried_in_priority_order()
    {
        var context = Context("10.0.0.5", ("True-Client-IP", "198.51.100.9"));

        ClientIp.Resolve(context, ["CF-Connecting-IP", "True-Client-IP"]).Should().Be("198.51.100.9");
    }

    [Fact]
    public void When_no_headers_are_trusted_a_client_cannot_choose_its_own_address() =>
        ClientIp.Resolve(Context("192.0.2.44", ("CF-Connecting-IP", "198.51.100.7")), [])
            .Should().Be("192.0.2.44", "a spoofed header must be ignored on a directly reachable server");

    [Theory]
    [InlineData("not-an-ip")]
    [InlineData("")]
    [InlineData("1.2.3.4, 5.6.7.8")]
    [InlineData("<script>")]
    public void A_malformed_header_value_falls_back_to_the_connection_address(string value) =>
        ClientIp.Resolve(Context("192.0.2.44", ("CF-Connecting-IP", value)), ["CF-Connecting-IP"])
            .Should().Be("192.0.2.44");

    [Fact]
    public void Ipv6_addresses_are_normalised() =>
        ClientIp.Resolve(Context("10.0.0.5", ("CF-Connecting-IP", "2001:DB8:0:0:0:0:0:1")), ["CF-Connecting-IP"])
            .Should().Be("2001:db8::1");
}
