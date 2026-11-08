# Use the Worker CI action

## Prepare the project

Commit `package.json`, `package-lock.json` and a `TARGET.wrangler.json` for
each target. Use a single JavaScript module with an explicit Worker name,
entrypoint and compatibility date. This action supports standalone Worker
configs without assets, build hooks, named Wrangler environments or custom
module rules.

Provide four npm scripts.

| Script | Runs |
| --- | --- |
| `check` | Project type checks |
| `lint` | Project lint checks |
| `test` | Worker runtime tests with synthetic bindings |
| `test:bundle` | Smoke tests for the exact module. The action passes the module and config paths as arguments. |

## Verify a commit

```yaml
permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - id: worker
        uses: vhco-pro/worker-ci-action@2451d9b0aebea258785cddaf2ddb9264d787a4d6 # v0.1.0
        with:
          target: vitepress
          commit: ${{ github.sha }}
```

| Input | What to pass |
| --- | --- |
| `project` | Worker directory relative to checkout. Defaults to the repository root. |
| `target` | Target slug. For `vitepress`, the config is `vitepress.wrangler.json`. |
| `commit` | Exact checked-out commit. |
| `tag` | Optional stable release tag. Fetch tags and pass it for a release build. It must point to the given commit. |

The `artifact` output is a runner-local directory containing `worker.mjs` and
`manifest.json`. The `digest` output is the module's SHA-256. Publish the
directory with the release workflow to make it available to other jobs.

The manifest records the source, target, Worker name, configuration hash,
lockfile hash and toolchain versions. The action compares Wrangler's upload
dry-run bytes to the tested module and stops if the two differ.
