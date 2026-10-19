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

Existing holders reset to zero boost at opening. A verified DEX purchase starts
an inactive wallet; additional purchases preserve its start and apply its
boost to the full received balance. A sale or outgoing contest-token transfer
resets it and, from the 19 October transition test onward, immediately restarts
it at the outgoing block timestamp on any remaining balance. Full exits stop
accrual. Ordinary incoming transfers cannot restart an inactive wallet. Zero-value token
transfers, approvals, native gas and transactions in other assets retain the
existing treatment. All eligible wallets accrue boost, not just the Top 100.
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


Restart policy version: AUTO_RESTART_REMAINING_V1 from event start
19 October 2026 (1792368000). Earlier completed events preserve their original
buy-to-restart reset semantics. New snapshots retain a boostAtOpening marker
so an outgoing transfer exactly at midnight cannot receive simulated opening
boost. The clock uses verified outgoing block time, never page load time.
