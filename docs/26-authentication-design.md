# Authentication Design

## MVP Decision

Authentication is not part of the MVP.

All specified product features are public and read-only, and the product stores
no user-owned data. The initial schema therefore contains no user, role,
session, or token tables, and the API has no registration, login, refresh,
logout, or profile endpoints. Operational access is protected by GitHub,
Render, and database controls rather than an application administrator route.

Do not scaffold dormant auth code.

## Activation Trigger

Implement authentication only when an accepted feature requires durable
user-owned data, such as saved comparisons, dashboard preferences, alerts, or
private reports. That change requires:

- an updated MVP/release scope;
- threat-model review;
- database migration;
- API and frontend contract updates; and
- security and end-to-end tests.

## Approved Future Design

When activated:

- identify users by normalized, unique email;
- hash passwords with bcrypt at cost factor 12 or the then-current measured
  equivalent targeting approximately 100-250 ms on production hardware;
- issue a 15-minute signed JWT access token;
- issue a random 30-day refresh token in an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie;
- store only a SHA-256 hash of each refresh token;
- rotate refresh tokens on use and revoke the token family on reuse;
- keep access tokens in browser memory, never local storage;
- require verified email before sensitive features;
- rate-limit registration, login, and refresh separately; and
- use exact-origin credentialed CORS plus Origin validation on cookie-backed
  state-changing requests.

Passwords must be at least 12 characters, allow password-manager input, and be
checked against a breached-password service before account creation if a
privacy-preserving integration is approved.

OAuth and role-based permissions remain future decisions, not scaffolding
requirements.
