# Cronos wallet profiles — integration branch, not live

Purpose: optional nickname/avatar for each wallet, on Cronos EVM chain 25.
Crypto.com Onchain is the primary mobile acceptance target. WalletConnect pairing
and the in-app injected EIP-1193 provider must both be tested on actual devices.
No transaction, approval, permit, raw eth_sign or typed-data signing is requested.
The connector requests only personal_sign. Account/network changes invalidate login.

## Implemented and tested

- SIWE 3.0.0 verification against an exact HTTPS domain, URI, chain, statement,
  server-issued message and 5-minute one-use challenge, bound to HttpOnly cookie.
- Atomic nonce consumption rejects concurrent replay; server-side 30-minute sessions,
  hashed opaque tokens, logout, exact-Origin CSRF protection and no cross-site CORS.
- The session determines the edited wallet; request bodies cannot select another owner.
- Unicode nickname validation, no markup; use textContent when displaying names.
- Max 1 MB JPEG/PNG/WebP, bounded decoded pixels, 256px WebP re-encoding without metadata;
  original uploads and SVG are not stored or served. Profile deletion removes the avatar.
- SQLite must reside on a persistent, private volume. Do not place the DB in site/.

## Run tests

Node 24. `npm ci --prefix profile-service` then
`node --test profile-service/auth.test.mjs`.
`PROFILE_ORIGIN=https://YOUR-EXACT-SITE-ORIGIN PROFILE_DB=/PRIVATE/PERSISTENT/profiles.sqlite node profile-service/server.mjs`

The service listens on loopback port 8787. Reverse-proxy `/api/profile/*` from the
same HTTPS site origin; the browser never receives secrets or database access.
Do not switch to insecure cookies or permissive CORS to accommodate GitHub Pages.
The current static GitHub Pages host cannot execute this service.

## Activation requirements and remaining work

1. Select/deploy a backend with persistent storage and an HTTPS same-origin proxy.
   Existing Netlify account is a candidate, but this Node/SQLite process is NOT a
   Netlify Function: adapt to that platform's transactional storage before deployment.
2. Create a project in https://dashboard.reown.com/ and allowlist the exact site origin.
   Set its project ID in deployment configuration, never substitute a sample ID.
3. Bundle profile-page.mjs (the initial editor and QR canvas are implemented). Finish
   the wallet picker/deep-link UI and select injected providers explicitly via EIP-6963.
   No automated wallet connection or signature on page load.
4. Connect leaderboard names/avatars to the public profile endpoint; keep abbreviated
   addresses visible. Score/rank/boost/chances never come from profile fields.
5. Add global edge rate limiting/quotas, backups/deletion policy and HTTP integration
   tests. The included per-process limiter is preliminary, not a distributed control.
6. Test on real Android/iOS Crypto.com Onchain: pairing, readable SIWE signature,
   cancellation, wrong chain, account change, disconnect and repeat login. Test smart
   contract wallets separately: the initial verifier currently targets EOAs only.

No deployed UI or claim of production readiness is included. Do not publish a
CONNECT WALLET button that silently stores profiles only in localStorage.
