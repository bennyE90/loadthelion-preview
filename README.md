# LoadTheLion preview

Deployment base originating from V124 (16 October 2026), preserving the subsequent ULTCROW preview and mobile fixes from the existing repository ZIP. The current branch also includes the wallet-profile build and ROAR test features described below.

## Source and publish directory

`site/` is the Netlify publish directory and contains both retained static assets/pages and generated build output. It is not the sole source of truth: edit the relevant files under `profile-service/public/` and the modules under `profile-service/` for the pages and bundles produced by `profile-service/build.mjs`. The build copies those pages, bundles browser code, generates configuration and modifies `site/home.html` in place. Direct edits to generated files can be overwritten by the next build; inspect the build script before choosing an edit location.

The generated entry point is `site/index.html`, sourced from `profile-service/public/entry.html`. The existing V124 image and video assets remain part of the project; the current build also prepares monthly preview assets and fonts. Keep the source files and generated output distinct when reviewing changes.

## Prerequisites and commands

Run repository commands from `loadthelion-preview/`. Use Node.js 24 or newer, npm and Python 3 for the static-reference check. `package-lock.json` pins npm dependencies; install them with `npm ci` when preparing a fresh checkout. The configured Windows workstation already includes Node, npm, Git and Python under its parent `tools/` directory, with paths recorded in `postazione.json`.

| Command | Purpose and effects |
| --- | --- |
| `npm ci` | Install the locked dependencies; writes `node_modules/`. |
| `npm run build` | Run `profile-service/build.mjs`; writes and overwrites files under `site/`. Requires the build configuration below. Monthly preview preparation may fetch external images, with a remote-image fallback if preparation fails. |
| `npm test` | Run the profile-service and repository Node test files selected in `package.json`. |
| `npm run test:profiles` | Run only the profile-service Node test files. |
| `npm run test:build` | Run the build twice, check home controls and script-policy uniqueness, then compare SHA-256 fingerprints of every publish file for identical output. This writes `site/` and can fetch monthly preview images; it is not a read-only check. |
| `python3 scripts/check_site.py` | Check local static references and publish-directory constraints. On Windows, use the configured Python 3 executable if `python3` is not on PATH. |

The recorded workstation baseline in `../TEST_SITO_COMPLETO_PC.log` is **118 passing tests and 0 failures**. This describes a past run, not a permanent test-count requirement or a fresh verification of every subsequent change. Use the result and test count from the current run when reporting checks.

## Build configuration and local preview

`npm run build` requires `REOWN_PROJECT_ID` to be a 32-character hexadecimal project ID and `PROFILE_ORIGIN` to be the exact HTTPS origin, without a path or trailing slash. Configure the real Reown project and intended site origin for a release. The build writes these public client settings to `site/profile-config.json`; a successful build alone does not validate wallet access or backend readiness.

On the configured Windows workstation, run these launchers from the parent workstation directory:

- `.\AGGIORNA_ANTEPRIMA.cmd` calls `setup/run.ps1 -Action build` with the bundled tools. It deliberately sets `REOWN_PROJECT_ID` to 32 zeroes and `PROFILE_ORIGIN` to `https://example.invalid` for local visual checks.
- `.\AVVIA_ANTEPRIMA.cmd` calls `setup/run.ps1 -Action preview` and serves the existing `site/` files on loopback, normally `http://127.0.0.1:8787/`; it selects a free port if needed and opens the browser. It does not rebuild first.

Those placeholder values are **not suitable for publication**. `npm run test:build` also falls back to those values when the corresponding environment variables are absent. After a local placeholder build or build test, regenerate the output with the intended release configuration before considering publication.

The workstation preview uses `setup/server.mjs` for graphics and navigation. It does not run the profile API or Netlify Functions; API requests return an unavailable response. Wallet/profile acceptance requires the configured HTTPS service and separate end-to-end checks.

## Checks and deployment

`netlify.toml` specifies **publish directory `site`**, **build command `npm run build`**, **Node 24** and the `netlify/functions` directory. Configure the required build environment in Netlify before a release. Repository settings do not prove the current Netlify dashboard configuration or the state of a live deployment.

The validation workflows check repository changes without deploying. The wallet-profile workflow also installs dependencies and builds with test placeholders. GitHub Pages deployment is manual only: **Deploy LoadTheLion preview manually** validates and uploads the existing `site/` directory after approval; that workflow does not run the npm build or provide the profile backend. It never unpacks `site.zip`.

Do not connect or change Netlify automatic publishing without separate approval. An existing Netlify connection can deploy on pushes independently of Actions. Browser/mobile playback and real wallet checks remain required; static checks alone do not certify device-specific video, rendering or wallet behavior.

## Current branch references and historical context

The sections below retain the earlier project description for history. Their statements about empty rankings, `awaiting-data`, weekly boost rules, one-decimal boost display and pending tokenomics details do **not** describe the current branch. They must not be used as current release specifications or new project commitments.

For the current implementation, inspect `profile-service/public/roar-snapshot.json` (currently marked `verified` in the `ULTON_TEST` environment), `profile-service/ROAR_CALENDAR_V2.md`, `profile-service/ROAR_MIN_BUY.md`, `profile-service/ROAR_REWARDS_TEST.md` and `profile-service/public/tokenomics.html`. The ULTON test data and simulated rewards are not live $LOAD rankings or payable rewards. These references document the branch; release approval and unresolved business decisions remain separate.

## Historical project description

### Official content and experiments (historical)

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

### Leaderboard presentation (historical)

The official table shows token balance, ROAR BOOST, points and chance.
Boost is displayed with one decimal and a bar from 0 to 200%; there are no
time estimates or purchase targets. Movement compares the current global ranking with the verified 00:00 UTC
leaderboard of the same token, chain and weekly event. The fixed daily baseline
resets at the next midnight UTC; NEW means absent from that midnight Top 100.
Without a verified midnight baseline no movement is inferred.

`site/roar-snapshot.json` deliberately starts in `awaiting-data` state. The UI
polls every five minutes and will not display a ranking without complete
transfer coverage, verified balances, opening balances and DEX classification.
The current ULTON checkpoint is incomplete, so no ULTON ranking has been
published or relabeled as $LOAD. Draw percentages remain unpopulated pending
confirmation. Run `node --test tests/roar-data.test.mjs` for scoring, reset,
movement, rejection and precision checks.
