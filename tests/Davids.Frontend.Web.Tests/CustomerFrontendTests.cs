using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Davids.Frontend.Web.Tests;

[Trait("Category", "Integration")]
public sealed class CustomerFrontendTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public CustomerFrontendTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    [Fact]
    public async Task ServesCustomerPortalAndLoginShellWithStrictCspAndZeroBrowserStorage()
    {
        using var client = factory.CreateClient();

        using var portalResponse = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, portalResponse.StatusCode);
        Assert.Equal("text/html", portalResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", portalResponse.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", portalResponse.Headers.GetValues("X-Frame-Options").Single());

        var csp = portalResponse.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("default-src 'self'", csp);
        Assert.Contains("script-src 'self'", csp);

        var portalHtml = await portalResponse.Content.ReadAsStringAsync();
        Assert.Contains("Customer Portal", portalHtml);
        Assert.Contains("Product Storefront", portalHtml);
        Assert.Contains("Shopping basket &amp; checkout", portalHtml);
        Assert.Contains("My orders &amp; payment receipts", portalHtml);
        Assert.Contains("My delivery profile", portalHtml);
        Assert.Contains("Change sign-in email", portalHtml);
        Assert.DoesNotContain("/admin-identity/", portalHtml, StringComparison.OrdinalIgnoreCase);

        using var loginResponse = await client.GetAsync("/login");
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginHtml = await loginResponse.Content.ReadAsStringAsync();
        Assert.Contains("Continue with Customer OIDC", loginHtml);
        Assert.Contains("Create customer account", loginHtml);
        Assert.DoesNotContain("/admin-identity/", loginHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("/app.css", "text/css")]
    [InlineData("/portal/app.css", "text/css")]
    [InlineData("/login.css", "text/css")]
    [InlineData("/app.js", "text/javascript")]
    [InlineData("/portal/app.js", "text/javascript")]
    [InlineData("/login.js", "text/javascript")]
    [InlineData("/favicon.svg", "image/svg+xml")]
    public async Task ServesStaticAssetsAtRootAndPortalPrefixWithNoBrowserTokenStorage(string path, string mediaType)
    {
        using var client = factory.CreateClient();
        using var asset = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.Equal(mediaType, asset.Content.Headers.ContentType?.MediaType);

        if (path.EndsWith(".js", StringComparison.Ordinal))
        {
            var script = await asset.Content.ReadAsStringAsync();
            Assert.DoesNotContain("localStorage", script, StringComparison.Ordinal);
            Assert.DoesNotContain("sessionStorage", script, StringComparison.Ordinal);
            Assert.DoesNotContain("/admin-identity/", script, StringComparison.OrdinalIgnoreCase);
        }

        if (path.EndsWith("app.js", StringComparison.Ordinal))
        {
            var appScript = await asset.Content.ReadAsStringAsync();
            Assert.Contains("DavidsWeb", appScript, StringComparison.Ordinal);
            Assert.Contains("/products", appScript, StringComparison.Ordinal);
            Assert.Contains("/baskets/me", appScript, StringComparison.Ordinal);
            Assert.Contains("/orders/checkout", appScript, StringComparison.Ordinal);
            Assert.Contains("/orders/me", appScript, StringComparison.Ordinal);
            Assert.Contains("/payments/me", appScript, StringComparison.Ordinal);
            Assert.Contains("/customers/me", appScript, StringComparison.Ordinal);
            Assert.Contains("/identity/me/email", appScript, StringComparison.Ordinal);
            Assert.Contains("/identity/me/password", appScript, StringComparison.Ordinal);
            Assert.Contains("/customer-auth/logout", appScript, StringComparison.Ordinal);
            Assert.DoesNotContain("innerHTML", appScript, StringComparison.Ordinal);
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/alive")).StatusCode);
    }
}
