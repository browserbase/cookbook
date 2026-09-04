# Local credential-wrapping simulation

This example demonstrates signed tokens, encrypted credential payloads, and RSA-OAEP wrapping to a recipient key. **It assumes a trusted local caller and a trusted vault server.** It does not implement production delegation, a zero-knowledge vault, or verified browser-session binding. Historical product names in paths and identifiers are demo labels, not evidence about those products' security architecture.

Use only synthetic credentials. The identity provider, vault, and visual control server bind explicitly to `127.0.0.1`. This prevents direct listening on other network interfaces; it does not authenticate local callers, protect against a compromised local process, or make forwarding these ports safe.

## What the code actually enforces

| Boundary | Implemented behavior | Missing guarantee |
| --- | --- | --- |
| Token issuance | `/token` signs the caller's chosen agent, user, host, and lifetime claims. | No caller authentication, user consent, or delegation policy. |
| Vault access | `/lease` checks the token signature, issuer, expiry, requested host scope, and agent/host enrollment. | A caller can obtain a matching token from the unauthenticated demo issuer. |
| Recipient key | The caller supplies an RSA public key; the vault wraps a fresh AES content key to it. | No attestation or binding between that key and a particular browser, session, or authorized caller. |
| Server trust | The vault decrypts stored credentials with a master key before creating the response. | No zero-knowledge property. The server sees plaintext and the fresh content key. The demo master key is a source constant. |
| Audit | `/audit` returns process-memory events. | No access control, durable audit storage, or token revocation service. |

A caller that chooses an enrolled agent and host can obtain a token, request a lease to its own public key, and decrypt the synthetic credential without any browser. The offline tests deliberately preserve this demonstration of the trust boundary. Binding the servers locally does not change it.

## Flow

1. The local identity-provider simulation signs caller-selected claims. Its issuer is a demo-specific URN.
2. The orchestrator starts a Browserbase session with this repository's demonstration extension.
3. The extension generates a recipient keypair and publishes the public key in a cookie.
4. The orchestrator sends the token, host, and public key to the vault.
5. The vault verifies the token and host scope, decrypts its stored credential, encrypts a lease with a fresh AES key, and wraps that key to the supplied RSA public key.
6. The orchestrator delivers the ciphertext through a cookie. The extension unwraps it, checks host and expiry, and fills the demonstration form.

The normal flow transports ciphertext, but the orchestrator is still trusted: it can substitute a key it controls when requesting a lease. The extension generates a non-extractable RSA private key: WebCrypto refuses private-key export, while public SPKI export and decryption remain available. This does not attest the browser origin or prevent code holding the key from using it to decrypt.

## Files

- `identity-provider.mjs`: dependency-free local token issuer and public-key endpoint.
- `vault-server.mjs`: dependency-free local credential wrapping and in-memory audit.
- `extension/`: demonstration key generation, cookie transport, unwrapping, and form filling.
- `demo.py`: Python orchestration; starts the local services and attempts the public demonstration login.
- `control.mjs` and `flow.html`: visual orchestration and an explanation of the same simulation.
- `tests/local-simulation.test.mjs`: offline handler, listener, and cryptographic boundary checks using synthetic enrollment.
- `tests/extension-key.test.mjs`: actual extension code with local WebCrypto; private export rejection, public-key cookie publication, and synthetic lease unwrapping/form filling.

## Run locally

For the offline checks, only Node.js is required:

```bash
node --test tests/*.test.mjs
```

For the Python browser demonstration, install this recipe's declared Python dependencies into an isolated environment, then install its Playwright browser:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Export `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` locally, then run `python demo.py`. This performs cloud/browser actions against the public demonstration site. It is separate from the offline checks.

The optional visual entrypoint is `node control.mjs`, served at `http://127.0.0.1:8791`. It also requires the Node Browserbase SDK and Playwright Core to be available; this directory currently has no Node dependency manifest, so it is not a reproducible standalone Node installation. The visual server starts the issuer and vault as child processes; clicking “Run live demo” starts the browser flow. Do not expose or forward these local services.

The service defaults are issuer port 8790 and vault port 8788. Each accepts a `PORT` override when launched separately. The vault's `IDP_BASE` selects its trusted issuer endpoint; keep it local for this simulation. Binding addresses are fixed to loopback. No live login or cloud lifecycle result is established by the offline tests.

## Requirements for a production design

A production system needs authenticated callers, authorized user/agent/host scope, a verified recipient-key and session binding, revocation and replay policy, protected key management, and an authenticated audit boundary. Those controls need a separate threat model and end-to-end validation. Changing the wrapping algorithm or calling the tokens “delegation” does not supply them. A zero-knowledge design would also require a different server-decryption boundary.

## Visual runner completion

The live runner fails if the extension key or nonempty login fields do not appear within its bounded polling attempts. Submit errors propagate. It then requires the exact demonstration site's `/secure` URL, a visible “Secure Area” heading, logout link and success notice, with no visible password field. Missing evidence fails the run; the diagram's explanatory steps do not establish login success.

The runner attempts browser disconnection and Browserbase session release on both success and failure. “Done” is set only after authenticated-page evidence and cleanup succeed. Cleanup failure remains an error even when authentication was observed. Offline runner fixtures cover deadlines, rejected submission, missing authentication evidence and cleanup failures; local Chrome fixtures check the DOM predicate. These checks do not prove a live cloud login or session release.
