# LoadTheLion preview

Static deployment base based on the approved V124 (16 October 2026), preserving the subsequent ULTCROW preview and mobile fixes from the existing repository ZIP.

## Source and publish directory

`site/` contains the exact 34 files of the existing repository ZIP plus `.nojekyll`. All V124 image and video assets are unchanged.
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

## Preserved experiments

`site.zip` is the original historical ULTCROW test package from commit
`78d2c064dd6af2ce3ce214a69449e5d980bfdb58`. It is retained for comparison,
not used by the new deployment. Its three ULTCROW files and modified `home.html`
are preserved byte-for-byte in `site/`, including the test leaderboard and mobile fixes.
`tests/hosting-check.html` is the former root placeholder, retained as history.
Neither is part of the publish directory. The private indexer is separate.

The existing contest copy, experimental probabilities, historical ULTCROW snapshot and pre-launch placeholders are preserved;
this cleanup does not approve new contest rules or live token data.
