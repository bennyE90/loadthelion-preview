# Calendar rounds and boost policy

Activation: **21 October 2026, 00:00:00 UTC** (`1792540800`).
Completed weekly snapshots, weights, plans and signed draws stay unchanged.
The transitional round beginning 19 October ends on 20 October at 23:59:59 UTC.
No current test prize or automatic transfer is enabled by this policy.

Rounds open on days **1, 11 and 21** at 00:00:00 UTC. They close on days
10, 20 and the actual last day of the month at 23:59:59 UTC. Thus the final
round lasts 8/9 days in February, 10 days in 30-day months and 11 days in
31-day months. There is no uncovered day or overlapping round.

Maximum boost is **+250.00%**, meaning **3.5× points**, attained after
**8 × 86400 seconds** of eligible holding. Boost advances in **0.01 percentage
point** steps: `steps = floor(min(elapsed, 691200) × 25000 / 691200)`.
A step matures on average every 27.648 seconds; integer blockchain timestamps
produce 27/28-second spacing. Points use exact integers:
`balanceRaw × (10000 + steps) / 10000`. No rounding up or floating-point
ranking is used. Display uses two decimal places, English formatting.

Every event opens with boost **0% and inactive for all wallets**, including
existing holders. A single authenticated purchase worth at least **5 USD**
activates it at its verified block timestamp. Separate sub-threshold purchases
do not accumulate. Further buys preserve an already active clock and apply the
multiplier to the full balance. Any positive sale, outgoing transfer, burn or
self-transfer resets the clock to inactive. Another qualifying $5+ purchase is
required even if tokens remain. Gifts cannot activate or reactivate boost.
Zero-value transfers, approvals, native gas and other assets do not reset it.
All eligible wallets participate, including those outside the Top 100.
Daily movement arrows still reset at 00:00 UTC, independently of rounds.

The snapshot score never extrapolates beyond a verified block. Each final uses
the last confirmed block strictly before the next opening, with its adjacent
block proving the boundary. Late collection cannot include a post-close block.
A February round may close before a newly activated boost reaches the exact
8-day cap (including the final-second difference in an 8-day round).

Archive verification, the browser, countdown and future randomness plans share
the UTC calendar. Plans remain tied to future signed randomness at least one
hour after the actual close; no replacement seeds or changed weights are used.
The canonical calendar module is copied byte-for-byte to the website.


Current activation policy: `MIN_BUY_USD5_V1`, applied to the active 19 October
2026 private test and later events. This supersedes the briefly tested automatic
restart policy. Completed earlier archives and their signed draws stay unchanged.
The current event is recomputed from its verified opening and purchase history.
See `ROAR_MIN_BUY.md` for the USD reference and supported test routes.
