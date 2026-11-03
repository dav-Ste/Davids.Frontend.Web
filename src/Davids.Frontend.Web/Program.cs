using Davids.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("davids-frontend-web");

var app = builder.Build();

app.Use((context, next) =>
{
    var headers = context.Response.Headers;
    headers.CacheControl = "no-store, no-cache, must-revalidate";
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; " +
        "frame-ancestors 'none'; form-action 'self'";
    return next();
});

app.MapMethods("/login", new[] { "GET", "HEAD" }, (IWebHostEnvironment env) =>
{
    var loginFile = Path.Combine(env.WebRootPath, "login.html");
    return Results.File(loginFile, "text/html; charset=utf-8");
});

app.MapMethods("/portal/login", new[] { "GET", "HEAD" }, (IWebHostEnvironment env) =>
{
    var loginFile = Path.Combine(env.WebRootPath, "login.html");
    return Results.File(loginFile, "text/html; charset=utf-8");
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    RequestPath = "/portal"
});
app.MapDefaultEndpoints();
app.MapFallbackToFile("index.html");
app.Run();

public partial class Program;
