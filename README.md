# Worker CI action

Verifies a locked npm Worker project using Node 24.19.0 and Bun 1.4.3.
The caller supplies a clean checkout commit, optional exact tag and an
explicit target. The project supplies `TARGET.wrangler.json` and the npm
scripts `check`, `lint`, `test` and `test:bundle`.

The action runs Wrangler's bundle and no-bundle dry runs, compares the emitted
module bytes and gives the exact candidate module to the caller's smoke test.
The output directory contains `worker.mjs` and `manifest.json`. The manifest
binds the artifact to the commit, tag, target, Worker name, config digest, lock
digest and toolchain. The action is for single-module Workers without assets,
build hooks or custom module rules. Run it in a job with read-only repository
permissions and synthetic bindings.
