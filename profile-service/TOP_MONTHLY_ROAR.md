# Top Monthly Roar — ULTON live test

The dedicated monthly indexer workflow reconstructs the full UTC calendar month
from confirmed ULTON transfer history. It authenticates the approved V2 pool and
WCRO/USDC reference pool, checks receipt logs, verifies all reconstructed balances
and excludes burn, project and contract addresses under the existing test policy.
The test policy currently has no project wallet addresses configured.

Buy USD uses attributed executed WCRO input. Sell and outgoing-transfer deductions
use executed swap value when present, otherwise previous-block token-pool reserves.
A first-liquidity deposit can use its own authenticated Sync reserves. WCRO/USD uses
a fully historical 15-minute TWAP ending before the operation's quarter-hour bucket,
with the explicit existing test convention 1 USDC = 1 USD. Values are integer USD
millionths; sub-micro amounts round down. This is a test reference valuation.

Negative net buy persists; incoming gifts add no buying points. Reaching a wallet
ends a buy route, preventing gifts from becoming purchases. Gas and approvals have
no ULTON Transfer and do not alter scores. Month boundaries are exclusive at the
next first day, UTC. Ties use first reach of final score then canonical address.
Only positive net buys occupy the three planned prize positions.

The monthly workflow has its own queue and resumable RPC cache. Its archive commit
preserves concurrent Top 100 changes with fast-forward retries. Weekly persistence
preserves the newest monthly folder. No prize transfers are enabled. The backend
pins monthly/latest.json to one private archive commit and exposes only public
rank totals. Missing or inconsistent history cannot manufacture scores.

Page: home.html#top-monthly-roar. Monthly leaderboard and podium hydrate nicknames
from the same existing profile API. An unknown nickname falls back to the short
wallet; late profile responses cannot overwrite a newer ranking. Delayed data is
labelled and expires after one hour; wrong-month data is always rejected.

Prizes: Loaded Lion, Dark Lion, Cyber Cub. Example artwork comes from the official
Mane City NFT integration guide: https://learn.mane.city/desktop/gameplay/nft-integrations
Build downloads and optimizes these collection examples when possible, with an
explicit remote fallback. The actual prize NFT IDs are still unselected. The page
labels collection previews and ULTON test status, not NFT ownership or delivery.

Validation: monthly indexer scoring tests; site monthly endpoint and DOM tests;
full existing site test suite, build, static references. Browser/physical Android
QA is unavailable in this execution environment.
