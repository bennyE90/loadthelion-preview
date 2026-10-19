# Roar live rewards — ULTON simulation

The private test simulates a pool of 1,000,000 ULTON (18 decimals) per event,
starting with the 19 October 2026 transition event. There is no deposit,
contract, token transfer or active claim mechanism. The future rewards page
and real LOAD funding/claim infrastructure are outside this change.

Pool emission is linear in UTC seconds over the actual event interval, using
integer token units. Emission clamps to zero before opening and to the exact
pool total at the exclusive event end. Remaining + released always equals
the original pool, including 28/29/30/31-day calendar periods.

Live row amounts are estimates: released pool × current rank percentage.
They are not historical accrual, vested entitlements, or time-weighted rewards.
Moving rank changes the estimate; leaving the final Top 100 means no allocation
under the approved 100-position model. Every final Top 100 wallet gets its
rank share independently of the NFT lottery result. Fewer than 100 qualifiers
leaves allocations unavailable; no unapproved redistribution is introduced.

Use the existing probabilities.json unchanged: first place receives exactly
5%, or 50,000 ULTON. Exact integer arithmetic uses 12 decimal places for
percentage weights. The source table sums to 99.999999999997%; its tiny
3-unit percentage dust and integer rounding remainder go to rank 100. The
whole pool is conserved, without renormalizing the first-place share.

At closing, estimates are hidden until a verified final snapshot is available.
The read-only /api/roar/rewards?eventStart=... endpoint reads one pinned private
archive commit, verifies the immutable full-snapshot hash, and publishes only
an explicit Top 100 allowlist. It requires the exact event, token, environment,
end−1 snapshot cutoff, adjacent chain-linked blocks bracketing the deadline,
a confirmed safe head and all existing balance/ranking checks. A snapshot
block at or beyond the deadline is rejected. Current snapshots, another event's
final, an unavailable archive and delayed finalization never unlock allocations.
The lottery beacon is not required to finalize reward shares. A verified final
cannot be replaced by a later read of the stale current feed.

USD amounts reuse the validated ULTON market quote, expire with it, and remain
unavailable when no valid price exists. They do not affect token allocations,
points, boosts or lottery weights. All added interface text is English.

## Day-nine visual preview (19 October)

For the transition event only, the pool UI uses a separate, clearly labeled
10 October 00:00 UTC → 20 October 00:00 UTC ten-day preview. At 19 October
00:00 UTC, exactly 900,000 ULTON is released and 100,000 remains; rank #1 has
a 45,000 ULTON estimate. The preview keeps advancing with real UTC time.
Verified rankings, boosts, snapshot dates, actual event timers and the final
archive endpoint are unchanged. This pool-only preview cannot finalize or
claim anything using the actual event's different deadline. At the preview
cutoff it stops at one million, hides unfinalized individual estimates and
shows SIMULATION COMPLETE. Subsequent calendar events use normal pool timing.

## Full visual event scenario

The preview now recalculates boost, points and ranking for all eligible wallets
from the pinned complete private current snapshot, returning only the simulated
Top 100 alongside the original verified Top 100. Wallets active at the actual
19 October opening are **assumed**, for this scenario, active from 10 October.
Their boost reaches +250% after eight days. Activation times later than the
real opening remain unchanged; inactive/reset wallets retain zero. This is an
explicit scenario assumption, not a claim that historical 10–19 October token
activity was reconstructed. The UI labels this simulated event and its rule.
Actual archive history, balances, calendar policy and lottery result stay intact.
The preview uses source snapshot time for scores; no extrapolated points or
post-cutoff snapshot can finalize it. The simulation timer ends 19 October UTC.

The pool panel now shows only a 0.00/100% → 100.00/100% release percentage and
filling progressbar with accessible value text. Pool capital, emitted token
sum, remaining balance and pool USD value are omitted. Individual estimated
wallet rewards and their USD values remain alongside Lion Chance.

## Daily movement in the simulated leaderboard

The simulation compares against the immutable actual opening snapshot at
00:00 UTC on 19 October, whose balances come from the last confirmed block
of 18 October. Both full private holder sets are recalculated with the same
10 October scenario before selecting each Top 100. The opening is fetched
from the same pinned archive commit as the current snapshot, checked against
its immutable hash, and its adjacent confirmed blocks must bracket midnight.
Only the Top 100 baseline is returned to the browser. Missing, altered,
post-midnight, wrong-day or wrong-event baselines leave arrows unavailable;
they never create invented changes. Green/red numbers report positions
relative to this fixed UTC baseline; NEW means outside its Top 100.
