# Top Monthly Roar — ULTON live test

The dedicated monthly indexer workflow reconstructs the full UTC calendar month
from confirmed ULTON transfer history. The initial October test starts at the
authenticated first pool liquidity on 2026-10-09 13:23:05 UTC; later months use
the complete calendar month. This coverage is explicit in the API and page. It authenticates the approved V2 pool and
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
from the existing profile store through public nickname/avatar read endpoints. Avatar reads return only the
existing WebP image and respect profile removal.
Wallet authentication remains unchanged. An unknown nickname falls back to the short
wallet; saved nicknames remain complete and wrap in the prize badges; late profile responses cannot overwrite a newer ranking. Delayed data is
labelled and expires after one hour; wrong-month data is always rejected.

Prizes: Loaded Lion, Dark Lion, Cyber Cub. Example artwork comes from the official
Mane City NFT integration guide: https://learn.mane.city/desktop/gameplay/nft-integrations
Build downloads and optimizes these collection examples when possible, with an
explicit remote fallback. The actual prize NFT IDs are still unselected. The page
labels collection previews and ULTON test status, not NFT ownership or delivery.

Validation: monthly indexer scoring tests; site monthly endpoint and DOM tests;
full existing site test suite, build, static references. Browser/physical Android
QA is unavailable in this execution environment.

Stage spotlight asset: site/assets/mane-city-spotlight.webp. Generated with the
built-in image generation tool, then optimized to a transparent 320px WebP.
Prompt: realistic suspended industrial moving-head LED spotlight for a Mane City
neon metropolis NFT stage, graphite metal, violet/cyan reflections, warm-white
underside lens, isolated transparent background, no text and no baked-in beam.
Responsive CSS draws the cone down to the full award area.

Prize gallery background: site/assets/mane-city-gallery.webp, generated using the
built-in image tool and optimized as an 1100px WebP. Prompt: prestigious Mane City
nighttime exhibition gallery, obsidian and dark brushed metal, champagne-gold trim,
violet/cyan/red neon skyline through large windows, empty central floor for the
live prizes and profiles, no lettering or logos. The gallery is confined to the
prize section and crops responsively without covering the live UI.

Current lighting uses three independent LED lenses positioned against the original
gallery ceiling, without dark coffer overlays; no cables or
shared bar. The central module remains higher. The lens width and initial cone
width use the identical --lens-half dimension, and both start at the same vertical
lens centre. This remains matched across responsive sizes. The cone widens down
to the end of the NFT award area. The old spotlight image is an unused source asset.

Each NFT award is displayed inside a decorative locked glass cabinet with a medal-
coloured metal frame, hinges, reflections and a keyhole. This is presentation only;
no custody or prize delivery behaviour is attached to the case. Current leaders
remain outside the glass and the spotlight follows the full cabinet height.

Vitrines now stand on stone plinths holding the current leader information. Glass
side/top panes add depth; a visible padlock closes each door. Inside the case only
the prize name remains, on a small engraved-style serif plaque. Collection-example
and test information remains in the shared note outside the cases.

The original NFT art remains unchanged: it is presented as a subtly angled framed
exhibit on a small internal rest, with contact shadows behind it and front-door
glass reflections above it.
