# Localhost testing through a cloud browser

This provider-neutral reference shows the architecture for running a compatible external test runner against an application bound to localhost while the browser itself runs on Browserbase.

> Demo and reference code only. The committed runner name and API endpoint are placeholders, no vendor integration is claimed, and no live result is implied. Adapt the protocol only after reviewing the runner's current API and obtaining authorization.

## Pattern

1. Start a synthetic application on `127.0.0.1`.
2. Expose it through an authenticated tunnel.
3. Create a Browserbase session.
4. Return that session's CDP endpoint from a narrow, local browser-connection shim.
5. Invoke an operator-supplied test runner with the tunnel authorization header.
6. Release only the session and child processes created by the current run.

## Reference files

| File | Purpose |
| --- | --- |
| `server.mjs` | Synthetic local sign-in fixture. |
| `acme-signin-ai.test.yaml` | Provider-neutral natural-language test descriptor. |
| `acme-signin.test.yaml` | Deterministic JavaScript test descriptor. |
| `test-runner.config.yaml` | Illustrative remote-browser configuration. |
| `shim.mjs` | Example interception of a browser-connection request. |
| `run-demo.sh` | Reference launcher requiring a compatible `test-runner` command supplied by the operator. |

## Local checks

```sh
node --test tests/signin.test.mjs
python3 tests/launcher.test.py
```

The checks use synthetic fixtures and shell stubs. They do not invoke a remote runner, tunnel, Browserbase session, or authenticated site.

## Adaptation requirements

- Replace all `example.invalid` endpoints with a reviewed provider contract.
- Keep API keys in an ignored local environment file.
- Verify that the runner supports CDP endpoints and scoped custom headers.
- Preserve the launcher's ownership checks so cleanup cannot terminate unrelated processes or sessions.
- Treat a successful local check as fixture validation only, not proof that a live integration works.
