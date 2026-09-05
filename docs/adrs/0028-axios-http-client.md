# 0028. Use axios for outbound HTTP requests

- Status: Accepted
- Date: 2026-09-05

## Context

The API makes outbound HTTP calls (GitHub OAuth, ADR 0020; likely more
integrations later). The initial GitHub client used Node's native `fetch`. We
want a single, consistent HTTP client with good ergonomics (interceptors,
timeouts, transforms, uniform error handling) across the project.

## Decision

Use **axios** as the HTTP client for outbound requests.

- Adapters that make HTTP calls take an injected **`AxiosInstance`**
  (`httpClient?`), defaulting to `axios.create()`. This keeps them unit-testable
  by injecting an instance configured with a fake **`adapter`** (axios's native
  adapter API — no extra dependency), consistent with ports/adapters (ADR 0027).
- Responses are typed as `unknown` (`http.get<unknown>` / `post<unknown>`) and
  validated with Zod (ADR 0011) — axios's default `any` on `response.data` never
  leaks (ADR 0009).

## Consequences

- One familiar HTTP client with interceptors/timeouts/error handling available
  project-wide.
- Adds a dependency for something Node can do natively — an accepted trade for
  the ergonomics and consistency.
- Unit tests inject an axios instance with a fake `adapter` returning canned
  responses; no network, no extra test dependency. (A full real-GitHub E2E is
  not automatable: the authorization-code grant needs a human browser login. A
  local mock-server integration test or a PAT-gated smoke test remain options if
  more confidence is wanted later.)
- axios rejects on non-2xx by default (unlike fetch), which we rely on for error
  propagation; endpoints that signal errors with a 200 body (e.g. GitHub's token
  endpoint) are still handled explicitly via Zod.

## Alternatives considered

- **Native `fetch`** (Node 24): zero dependency and already working, but lacks
  built-in interceptors/timeouts and needs manual non-2xx handling. Rejected in
  favor of axios's ergonomics and a single consistent client.
- **ky / got / undici:** capable, but axios is the most widely known and fits the
  team's preference.
