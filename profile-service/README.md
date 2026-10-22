# Cronos wallet profiles — implementation and activation

Optional nickname/avatar profiles for wallets on Cronos EVM, chain 25.
Crypto.com Onchain is the primary mobile acceptance target. WalletConnect pairing
and the injected EIP-1193 provider require acceptance checks on actual devices.
The connector requests `personal_sign` for sign-in; it does not request a
transaction, token approval, permit, raw `eth_sign` or typed-data signature.
Account/network changes invalidate login.

This document describes the code in this branch. It does not certify a current
deployment, provider plan, configured secret or completed mobile acceptance.
The site's ULTON rankings and reward simulations are test features, separate
from wallet-profile ownership and from any future $LOAD launch or real prize.

## Implemented components

- `auth.mjs` provides the standalone SQLite implementation. `blob-profiles.mjs`
  provides the Netlify Blobs implementation, with strong reads and ETag conditional
  writes for one-use challenges and concurrent profile changes.
- Both implement SIWE 3.0.0 verification against the exact HTTPS domain, URI,
  chain and statement in a server-issued, five-minute challenge. Session tokens
  are opaque, stored by hash and expire after 30 minutes. The verified session
  determines the edited wallet; request bodies cannot select another owner.
- The HTTP handlers use HttpOnly, Secure, SameSite=Strict cookies, reject
  unexpected Origins on writes and do not enable cross-site credentialed CORS.
- Nicknames are validated Unicode text. Avatars accept static JPEG/PNG/WebP up
  to 1 MB, bound decoded pixels and re-encode to 256px WebP without metadata.
  Original uploads and SVG are not served; deleting a profile removes its avatar.
- `netlify/functions/profile.mjs` routes `/api/profile/*` through
  `profile-handler.mjs` and the site-scoped `loadthelion-profiles-v1` store.
  Its configuration declares 60 requests per 60 seconds, aggregated by IP/domain.
  A missing `PROFILE_ORIGIN` produces a 503 response. Provider enforcement must
  still be checked in the deployed environment.
- `netlify/functions/profile-cleanup.mjs` declares daily cleanup at 03:17 UTC
  for expired sessions/challenges. A schedule in source is not evidence of a
  successful scheduled run.
- `build.mjs` bundles the profile/wallet UI, copies public pages and appends
  `leaderboard-profiles.mjs` to the generated ROAR script. Leaderboard hydration
  uses batches of up to 100 public profiles; profile fields do not determine
  score, rank, boost or chance. Wallet addresses remain available to the UI.
- The wallet picker supports injected-provider discovery and WalletConnect
  pairing. Connection/sign-in requires an explicit user action. Existing
  automated pairing tests do not replace physical-device acceptance.

## Install, test and build

Run these commands from the repository root, `loadthelion-preview/`, using
Node 24 or newer and npm:

```sh
npm ci
npm run test:profiles
npm test
```

`npm ci` installs the root lockfile dependencies. The two test commands are
alternatives for a focused profile-service run and the broader repository run;
there is no need to run both after every documentation change. The profile-service
selection includes `auth.test.mjs`, `blob-profiles.test.mjs` (including the HTTP
handler checks), wallet discovery/pairing tests and the other current service
tests. Report the current run's results rather than treating a past test count
as fixed. These commands do not establish live provider or wallet readiness.

Netlify uses `npm run build`, publishes `site/` and bundles `netlify/functions`
with Node 24 as configured in `netlify.toml`. Set `REOWN_PROJECT_ID` to the real
32-character hexadecimal project ID and `PROFILE_ORIGIN` to the exact HTTPS
site origin, without a path or trailing slash. The origin must also match the
service configuration and the project's allowed origins. A project ID is public
client configuration, not a private key; the build checks its format, not its
validity with Reown.

The build writes files under `site/`, including bundles, pages and
`profile-config.json`, and modifies the home page. Edit the corresponding sources
under `profile-service/`, not generated output that a later build overwrites.
`npm run test:build` also writes `site/`: it runs two builds and compares output.
Its fallback values, and those in the Windows workstation's local build launcher,
are a zero-filled project ID and `https://example.invalid`. They are for visual
testing only; rebuild with the intended configuration before publication.

## Standalone SQLite development path

`server.mjs` remains a separate Node HTTP server, not a Netlify Function. To use
that path, set `PROFILE_ORIGIN` to the exact HTTPS site origin and `PROFILE_DB`
to an absolute database path on a persistent private volume, then run
`node profile-service/server.mjs` from the repository root. It creates/uses that
database and listens on loopback port 8787 by default (`PORT` overrides the port).
Do not put the database in `site/`.

This development server does not implement `/api/profile/status` or
`/api/profile/lookup`. The current `browser-entry.mjs`/`modal-entry.mjs` UI checks
the status endpoint, and leaderboard hydration uses lookup. The standalone server
is therefore not a complete replacement for the Netlify adapter with the current
UI; those endpoint contracts would need to be aligned first.

Reverse-proxy `/api/profile/*` from the same HTTPS site origin. For that setup, set
`PROFILE_TRUSTED_PROXIES` to the exact proxy socket IPs, comma-separated (for example,
`127.0.0.1,::1`). The proxy must overwrite `X-Forwarded-For` with one original
client IP, never append or pass through a client-supplied value. Only explicitly
trusted peers may provide this identity. Missing, invalid or multiple IP values
from a trusted peer are rejected; untrusted forwarding headers are ignored.
IPv6 spellings and IPv4-mapped IPv6 share their canonical client quota. Zone IDs,
address/port pairs, CIDRs and wildcard trust are not accepted.

Without `PROFILE_TRUSTED_PROXIES`, the socket peer is the client identity; this
default is for direct connections, not a multi-user proxy. Recognized API routes
share 40 requests per minute per client; unknown routes do not consume that quota.
Over-quota responses use HTTP 429 and `Retry-After` seconds. The limiter remains
per-process, separate from any aggregate proxy/service cap and from the Netlify
edge rate rule. The
static GitHub Pages host cannot execute this service. The workstation's
`setup/server.mjs` preview serves graphics/navigation only and does not run
either profile backend. Do not weaken cookies or CORS to turn that preview
into an authenticated service.

## Activation checks still distinct from implementation

1. Verify the intended site's HTTPS origin, actual Reown project/allowlist and
   provider configuration. Use the existing Netlify adapter when that is the
   chosen deployment path; it does not require a new SQLite-to-Functions rewrite.
2. Inspect the build/deploy result for function bundling, native `sharp` support,
   rate-rule acceptance, configured visibility and persistent Blobs access.
   Verify `/api/profile/status`, wrong-Origin rejection, session expiry, logout,
   concurrent challenge reuse, nickname/avatar updates and deletion in that
   environment. Local fixture tests are separate evidence.
3. Check backups, retention/deletion procedures and observed cleanup runs.
   The cleanup code removes expired authentication records; it is not a complete
   backup or operational retention policy.
4. On actual Android/iOS Crypto.com Onchain, check pairing, readable SIWE scope,
   cancellation, wrong chain, account change, disconnect and repeat login.
   Smart-contract-wallet signatures remain outside the initially supported
   EOA verification path and require separate work/acceptance.
5. Verify leaderboard profile lookup in the chosen environment. Keep the ULTON
   test label and simulated/no-prize status; successful profile sign-in does
   not activate real $LOAD rankings, funding, claims or prize transfers.

Publishing or changing site visibility remains a separate authorized action.
Do not present localStorage-only profile edits as a deployed profile service.

## Historical setup notes — 17 October 2026

The earlier notes recorded a Netlify operational-credit pause, with a billing
period shown as 16 October–15 November and no paid plan active at that point.
A later entry on the same date recorded the Personal plan as active, automatic
recharge disabled and the Blobs adapter prepared. Those are successive historical
observations, not a statement of today's plan, cost, limits or deploy availability.

The same notes recorded creation of a Reown project named LoadTheLion on Starter
and `https://bennye90.github.io` as an allowed origin. Recheck the actual current
project and intended HTTPS origin before activation. Nothing in this document
changes a provider plan, purchases a service or authorizes a new expense.
