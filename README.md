# LoadTheLion preview

Static deployment base based on the approved V124 (16 October 2026), preserving the subsequent ULTCROW preview and mobile fixes from the existing repository ZIP.

## Source and publish directory

`site/` contains the public pre-launch $LOAD website. All V124 image and video assets are unchanged. The Top 100 and tokenomics pages are separate static documents.
The entry point is `site/index.html`; ENTER IN plays the V6 video with audio
and then opens `home.html`. No package install or build is required.
Netlify: publish `site`, leave build command empty (also set in `netlify.toml`).

## Checks and deployment

Run `python3 scripts/check_site.py`. Validation runs on pushes and pull requests
and does not deploy. GitHub Pages deployment is manual only: run
**Deploy LoadTheLion preview manually** on the intended branch after approval.
It validates and uploads only `site/`. It never unpacks `site.zip`.

Do not connect or change Netlify automatic publishing without separate approval.
An existing Netlify connection can deploy on pushes independently of Actions;
its dashboard settings have not been verified by this repository change.

## Official content and experiments

THE TOP 100 ROAR is confirmed. The official leaderboard is `site/roar.html`.
It intentionally has no rankings, prices, holding-time scores or draw results
until verified $LOAD data and final rules are available. The dashboard links
to the official Top 100, tokenomics and security pages.

`tests/ultcrow/` retains the historical ULTCROW snapshot and experimental page
outside the publish directory. Its first 10 verified holders are visible, with
SHOW MORE revealing the next 10. ROAR BOOST is a test specification: +0–200%
over six days, reset Monday 00:00 UTC; outgoing transfers/sales reset boost,
and only a new purchase restarts accrual. The old balance-only snapshot does
not calculate boost or pretend to be live $LOAD data. The private indexer is separate.

`site.zip` is the original historical test package, kept for rollback comparison;
it is never unpacked or published by the current workflows. Git preserves all
prior page versions. No V124 image, coin, logo or video has been regenerated.

Tokenomics shows the planned 25% launch purchase and the founder's 20% share
of creator fees. The purchase denominator, launchpad and other allocations are
explicitly pending. Previous conflicting draft splits are preserved in Git history,
not presented as finalized project commitments.

Checks cover local references and prevent ULTCROW files/references from entering
the official publish directory. Browser/mobile playback QA remains required;
static checks alone do not certify device-specific video or rendering behavior.
