# Top Monthly Roar

Private ULTON preview, independent of Top 100 Roar. Planned podium: 1 Loaded Lion,
1 Dark Lion, 1 Cyber Cub. No tickets or additional token pool. No prize transfer.
Specific NFT IDs have not been supplied; the page does not invent NFT artwork.

The page lives at `home.html#top-monthly-roar` or directly at `monthly.html`.
Build copies templates from `profile-service/public/` and adds navigation and a
full-height iframe using the existing header clearance and scroll-progress code.

USD net buy = buys minus sells minus outgoing transfers, valued at each operation.
Incoming gifts add nothing. Keep negatives; do not reset or clamp. Ignore native
gas, approvals and unrelated tokens. Project-wallet exclusions must be verified.
Periods are calendar months in UTC. Ties use earliest final-score reach, then
canonical lowercase address. Only positive eligible scores qualify for prizes.

## Monthly data status

Existing holder/boost snapshots do not contain complete monthly USD totals.
The UI therefore shows AWAITING_HISTORY until the indexer supplies the dedicated
`monthly/latest.json` on `roar-test-archive`. This change adds the page, exact
score calculator, monthly validation and a same-origin archive relay. It does
not yet implement historical pricing or monthly export in the indexer, certify
winners or activate prizes. Do not substitute current token balances/current
spot prices for transaction-time USD history.

The export uses schema 1, status VERIFIED, environment ULTON_TEST, chainId 25,
the pinned test token, prizesEnabled false, eventStart/eventEnd (exclusive),
historyFrom = eventStart, complete/transactionPricesVerified/exclusionsVerified
true, snapshotTimestamp, and a complete sorted ranking. Each row contains rank,
lowercase address, buysUsd/sellsUsd/outgoingUsd decimal strings (up to six places),
netUsdMicros (signed integer string), reachedAt (Unix seconds). The publisher must
verify deduplication, DEX classification, transaction prices and exclusions before
setting flags. The relay checks consistency and reads one pinned archive commit;
its verification flags remain an indexer trust assumption, not independent proof.
Only the first 100 rows' public totals reach the client. Missing, partial, stale,
wrong-month or inconsistent exports hide the ranking. No final-winner service is
implemented. An unavailable/closed month never implies a prize was distributed.

Checks: `node --test profile-service/monthly.test.mjs`, build, static references.
