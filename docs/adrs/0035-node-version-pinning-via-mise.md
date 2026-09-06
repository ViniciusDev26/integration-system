# 0035. Pin the exact Node version with `.tool-versions` (mise)

- Status: Accepted
- Date: 2026-09-06

## Context

The project targets Node.js 24 (ADR 0001) and declares `engines.node: ">=24"`
in `package.json`, with npm's `engine-strict` (ADR 0006) refusing installs on an
older Node. But `>=24` is a *floor*, not an exact version: two developers (or CI)
can satisfy it with different Node 24.x patch releases. We want everyone —
humans, agents, and CI — to run the **same exact** Node version, matching the
`node:24`-based production image (ADR 0023), so "works on my machine" gaps and
version-specific behavior differences don't creep in.

We also want that pin to be **activated automatically** on entering the project
directory, not something each person remembers to `nvm use`.

## Decision

Pin the exact Node version in a **`.tool-versions`** file at the repo root,
managed by **mise**:

```
nodejs 24.18.0
```

- `mise` (which reads the `asdf`-compatible `.tool-versions` format) auto-selects
  Node **24.18.0** when you `cd` into the project, so the local runtime matches
  across machines without manual switching.
- This **complements**, and does not replace, the existing guards: `engines`
  (ADR 0001) + `engine-strict` (ADR 0006) remain the enforced floor at install
  time; `.tool-versions` provides the exact, auto-activated version on top. The
  pinned patch stays `>=24`, so the two never conflict.
- Bumping Node means editing `.tool-versions` (and, if the floor moves,
  `engines`) in one change — keeping local, CI, and the Docker image aligned.

## Consequences

- Everyone with mise installed runs an identical Node patch release
  automatically; version-specific behavior is reproducible.
- `.tool-versions` uses the `asdf` format, so it also works for contributors
  using `asdf` instead of mise — not mise-exclusive.
- Contributors **without** mise/asdf are unaffected: nothing forces the tool.
  They still get the `engines`/`engine-strict` floor, just not the exact
  auto-activated pin. The pin is a convenience + consistency aid, not a hard gate.
- One more small root file to keep current; the pinned version must be bumped in
  step with the `engines` floor and the Docker base image to avoid drift.

## Alternatives considered

- **Only `engines` + `engine-strict` (no pin file):** already in place, but only
  enforces a *floor* (`>=24`), allowing patch drift between environments and no
  auto-activation. Insufficient for exact reproducibility.
- **`.nvmrc` (nvm):** pins an exact version too, but `.tool-versions` covers Node
  *and* any future tool (e.g. a pinned package manager or language) in one file,
  and mise activates it automatically without a shell hook step. Chose the more
  general format.
- **Rely on the Docker image only (ADR 0023/0029):** guarantees the runtime in
  containers, but many dev/test loops run Node directly on the host; the pin
  keeps host runs aligned with the image too.
