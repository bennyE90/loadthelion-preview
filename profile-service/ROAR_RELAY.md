# ULTON test snapshot relay

The private indexer publishes only after its full SQLite archive has been pushed.
`POST /api/roar/publish` accepts an ephemeral, RSA-signed GitHub Actions OIDC
token scoped to this endpoint, the pinned private repository IDs, two approved
branches and the exact Roar workflow. No permanent publishing password is used.
No draw or prize can be triggered through this endpoint.

The relay reconciles active, zero-balance, eligible and excluded holder counts,
checks the ranking and archive reference, then conditionally updates a site-wide
Blobs key. Older, conflicting and incomplete snapshots are rejected. Content
hashes identify immutable published snapshots. A storage failure does not replace
the last valid publication. The SDK fetch guard rejects failed conditional writes.

The page polls the read-only endpoint every five minutes while visible, uses
ETags, retains its last valid result on errors and uses the bundled snapshot
only as a first-load backup. It displays snapshot block/time and delayed updates.
The scheduled indexer runs approximately every fifteen minutes; GitHub scheduling
and RPC availability can delay it. This is a test, not a real-time oracle or a
prize payout service. Full rankings and proof remain in the private archive.

Private project mode: Netlify protection rejects external requests before
Functions execute, including the prepared OIDC publisher. The workflow variable
`ROAR_SITE_PUBLISH_ENABLED` stays unset. Instead the site supports server-side
reading through the existing private login, enabled by a secret environment
variable `ROAR_ARCHIVE_READ_TOKEN` available to Functions. The GitHub fine-grained token
must grant Contents: read-only to `bennyE90/loadthelion-indexer` only; it needs no
write, Actions or account permissions. Create/store it through the providers'
secure settings, never chat, code or browser cookies.
On Netlify Personal the secret scopes also include Builds and Runtime; separate
Functions-only scope selection requires a different plan. No upgrade is needed.
Set the secret for Production and Deploy Previews, leave local development
empty and redeploy after saving it. Untrusted deploys keep requiring approval.

The reader pins latest/index/full ranking to one archive commit, verifies both
content hashes and matching rankings, returns only the public Top 100 and reuses
the same conditional publication guard. Refreshes are coalesced and cached for
five minutes; stored fresh snapshots are reused for ten minutes. Source outages,
expired permissions or invalid data retain the last verified result. Without
this connection the page explicitly displays its saved backup. OIDC does not
bypass team login; do not change visibility or copy browser cookies to CI.
