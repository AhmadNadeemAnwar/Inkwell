namespace Inkwell.Api.Middleware;

/// <summary>
/// Defensive response headers for the JSON API. The API never serves HTML in production, so the
/// policy is as strict as it can be: nothing may be loaded or framed from an API response, and
/// authenticated responses are never cached by browsers or intermediaries.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _allowSwaggerUi;

    public SecurityHeadersMiddleware(RequestDelegate next, bool allowSwaggerUi)
    {
        _next = next;
        _allowSwaggerUi = allowSwaggerUi;
    }

    public Task InvokeAsync(HttpContext context)
    {
        // Set when the response starts so the headers also land on error and rate-limit responses.
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "no-referrer";
            headers["X-Frame-Options"] = "DENY";

            var isSwagger = _allowSwaggerUi && context.Request.Path.StartsWithSegments("/swagger");
            if (!isSwagger)
            {
                headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
                headers["Cache-Control"] = "no-store";
            }

            return Task.CompletedTask;
        });

        return _next(context);
    }
}
