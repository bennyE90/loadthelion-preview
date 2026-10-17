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
