# $5 activation — private ULTON test

`MIN_BUY_USD5_V1` replaces automatic restart for the active event starting
19 October 2026 and all later events. Every wallet starts inactive at 0%.
A single qualifying buy activates boost; additional buys retain its clock.
Every positive outgoing contest-token transfer (including sale, burn or
self-transfer) resets it to inactive. A new qualifying buy is then required.
Gifts and separate buys below $5 cannot activate it. Gas, approvals, zero-value
transfers and other assets have no effect. Rank, chance and reward weights
are unchanged; inactive holders still have base balance points.

## Deterministic USD reference

The private ULTON test supports an authenticated VVS V2 WCRO buy route using
the policy-pinned token pool and factory. USD value uses the swap's actual
WCRO input, allocated to each recipient's verified received token share.
Mixed router inputs are attributed proportionally using verified balances just
before the transaction; the unsupported pool's portion cannot inflate eligibility.
Only tokens delivered to the transaction sender count, excluding router fee
collectors and purchases gifted to someone else. Sponsored/bundled account routes
need a dedicated authenticated adapter before launch.
An ambiguous multi-approved-swap receipt or unsupported quote asset does not qualify;
this is not a claim of universal router/DEX support for a future $LOAD launch.

WCRO is valued using a >=15-minute V2 cumulative price average on the pinned
WCRO/USDC reference pair, ending at the block immediately **before** purchase.
Both anchors, reserves, cumulative values, block hashes, token order, decimals
and factory pair identity are checked. Each anchor requires >=100,000 USDC
in reference reserves. USDC is defined as a $1 reference for this private test;
it is not a fiat redemption guarantee or a production oracle audit.
Missing/malformed reference evidence stops publication instead of guessing.
No current web quote is used to backdate eligibility.

The comparison is exact integer arithmetic against 5,000,000 USD micro-units,
without rounding up. A purchase below the threshold remains inactive. Gas is
excluded. A receipt's allocation cannot exceed its authenticated token output.
Historical evidence and decisions remain in the private snapshot, excluded
from public Top 100 payloads. Re-running against the same chain evidence gives
the same decision. No tokens, claims or real prizes are enabled.

Existing append-only opening records, previous current snapshots and signed
draws remain intact. During the current UI scenario, the same verified opening
balances form an inactive-zero baseline under the new policy; the old assumption
that opening holders had already accrued eight days is removed. Current source
purchase times are retained. Finals still exclude every post-event block.

## Full 10–19 October historical simulation

The private preview now reconstructs its own opening at 10 October 00:00 UTC,
verifies opening/current/daily balances against onchain balanceOf, and replays
all qualified buys and outgoing token transfers from that opening. Earlier
completed competition snapshots and signed draws are not rescored. The actual
19 October competition source remains separately archived with its own start.

The simulation ranking and midnight ranking are bound to the current verified
block and referenced by a SHA-256 hash in that source. Each historical purchase
assessment is stored once by content hash; a simulation lists those hashes.
All inputs remain available in the permanent private archive. No assumed opening
activation, fabricated purchase or extrapolation beyond the sampled block is used.

For purchases before 19 October, the USD reference uses a preceding 15-minute
UTC bucket: a >=15-minute WCRO/USDC cumulative average ending strictly before
the bucket boundary, at most 905 seconds before the purchase. Transactions on
or after 19 October retain their original previous-block price alignment.
Both methods exclude future prices. Historical block lookups and oracle calls
are batched/cached so subsequent cycles replay the same evidence efficiently.
