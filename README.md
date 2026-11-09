# Davids.Frontend.Web — Customer Self-Service Web Portal

`Davids.Frontend.Web` is the standalone `.NET 10` stateless Customer Web Portal for **Davids Services**, served behind `Davids.APIGateway` using OpenID Connect Authorization Code + PKCE (`S256`) and an isolated `HttpOnly` BFF session cookie (`davids_customer_bff`).

## Key Capabilities

- **Self-Service Registration & OIDC PKCE Sign-In**:
  - Registers customer accounts via `POST /identity/sign-up` and initiates PKCE `S256` SSO via `GET /customer-auth/login` (`davids-web`, callback `/signin-customer-oidc`).
  - Zero tokens in `localStorage` or `sessionStorage`; all mutations carry `X-Requested-With: DavidsWeb` CSRF verification.
- **Customer Profile Self-Service (`Davids.Services.Customers`)**:
  - Reads and updates own delivery profile via `GET /customers/me` and `PUT /customers/me` (completing `incomplete -> valid` registration or updating `fullName` and `address`), plus VIP standing and completed order count.
- **Credential Management & Email Sync (`Davids.Services.Identity`)**:
  - Rotates login email via `PUT /identity/me/email` (persisting an `identity.email_changed` SQL Outbox event synced into `customersdb`) and rotates passwords via `PUT /identity/me/password` with immediate token revocation.
- **Personal Activity & Audit Transparency**:
  - Displays personal sign-in history (`GET /identity/me/login-audits`) and field-level mutation logs (`GET /identity/me/change-audits` and `GET /customers/{customerId}/change-audits`).

## Local Ports & Gateway Routing

- Direct asset host (Aspire / local dev): `http://localhost:17322`; sign-in and API calls require the gateway origin.
- Via `Davids.APIGateway` (`http://localhost:17320/` (or HTTPS when configured); customer login is `/login`)

## Build & Test

```powershell
dotnet restore Davids.Frontend.Web.slnx --locked-mode
dotnet build Davids.Frontend.Web.slnx --no-restore -c Release -warnaserror
dotnet test Davids.Frontend.Web.slnx --no-build -c Release
```
