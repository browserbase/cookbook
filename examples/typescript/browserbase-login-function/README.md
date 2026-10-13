# Log into Browserbase with Functions and Secrets

Deploy a Stagehand v4 browser workflow as a Browserbase Function. The Function reads login credentials from attached Secrets, signs into Browserbase with email and password, and checks whether the authenticated dashboard is visible.

Stagehand identifies each submit button before the corresponding credential is filled. Native Stagehand locators fill the fields and click the identified buttons. Credential values are never interpolated into model instructions. Stagehand still processes page content, which may include the account email displayed by the site. Session recording is enabled so you can inspect replays in the Browserbase dashboard. Stagehand uses its default logging; browser session logging remains disabled. Replays and page content can include account information.

## Prerequisites

- Node.js 24 and npm (the hosted build is constrained to the Node 24 release line).
- A Browserbase project with access to Functions, Secrets, and the Model Gateway.
- The official [Browserbase CLI](https://www.npmjs.com/package/browse) (`browse`), with the Secrets commands shown below.
- A Browserbase account that supports email/password login. Google sign-in, company SSO, MFA, and email verification are not automated by this recipe.

The Function uses Browserbase's Model Gateway; no separate model-provider API key is required. Running it consumes browser and model usage. It submits a real sign-in attempt, then closes the browser. It does not persist the authenticated session or change dashboard settings.

## Install and configure

Install the Browserbase CLI and confirm that Secrets commands are available:

```sh
npm install -g browse
browse cloud secrets create --help
```

From the cookbook root:

```sh
cd examples/typescript/browserbase-login-function
npm ci --ignore-scripts
test -f .env || cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in the local `.env`. For local login testing, also set `BROWSERBASE_LOGIN_EMAIL` and `BROWSERBASE_LOGIN_PASSWORD`. Do not commit `.env` or pass credentials as invocation parameters.

Upload the extension bundled with this installed Stagehand version:

```sh
browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
```

Replace `REPLACE_WITH_UPLOADED_STAGEHAND_EXTENSION_ID` in `index.ts` with the returned extension ID. The ID is project-specific configuration, not a secret. It must be present in the source because the hosted build does not receive your local `.env`.

## Publish and manage Secrets with the Browserbase CLI

```sh
npm run typecheck
npm run publish:function -- --dry-run
npm run publish:function
```

The dry run checks the upload archive; it does not compile, deploy, or execute the Function. Save the Function ID returned after the hosted build succeeds.

Use the Browserbase CLI to create and attach Secrets before invoking the deployed Function. Run these setup commands in your terminal, not inside the Function. Enter each value at the interactive CLI prompt, not in the command or source code:

```sh
browse cloud secrets create BROWSERBASE_API_KEY
browse cloud secrets create BROWSERBASE_LOGIN_EMAIL
browse cloud secrets create BROWSERBASE_LOGIN_PASSWORD
```

If these Secrets already exist in your project, reuse their IDs from `browse cloud secrets list`. Attach all three to the published Function:

```sh
browse functions secrets attach <function-id> <api-key-secret-id>
browse functions secrets attach <function-id> <email-secret-id>
browse functions secrets attach <function-id> <password-secret-id>
```

The deployed handler reads these values from `context.secrets`. Only local development falls back to environment variables. The publish archive excludes `.env` files.

Verify that the Function has all three Secret names attached. This command lists metadata, not the secret values:

```sh
browse functions secrets list <function-id>
```

Then invoke the Function with the Browserbase CLI:

```sh
browse functions invoke <function-id>
```

## Local execution

With the extension ID configured and all three local environment values set:

```sh
npm run dev
```

From another terminal, invoke the local server:

```sh
curl -X POST http://127.0.0.1:14113/v1/functions/browserbase-login/invoke \
  -H 'Content-Type: application/json' \
  -d '{"params":{}}'
```

Local execution still uses a real hosted browser and incurs usage. The local Functions server does not automatically load attached project Secrets.

## Results and limitations

On verified dashboard visibility, the handler returns:

```json
{ "status": "authenticated", "sessionId": "<session-id>" }
```

An unsupported sign-in flow, rejected credentials, timeout, or browser error returns a bounded diagnostic:

```json
{ "status": "not_authenticated", "stage": "password", "sessionId": "<session-id>" }
```

The stage is `connect`, `email`, `password`, or `verification`. It identifies where the workflow stopped, not the underlying cause. Check `status` even if the Functions invocation itself completed successfully. Missing configuration and cleanup failures fail the invocation with a sanitized error.

The workflow restricts credential submission to `https://www.browserbase.com`. It waits up to 20 seconds for each credential field and up to 30 seconds for the post-submit redirect; model calls have their own runtime limits. Dashboard verification is an AI assessment, not a server-side authentication or account-identity assertion. No success is claimed for MFA, SSO, onboarding, or uncertain pages. A changed login UI can require an update.

Validation currently covers dependency installation, TypeScript checking, Function registration, and the publish archive. A successful account login has not been verified.

See the [Functions SDK](https://github.com/browserbase/sdk-functions-node) and [Secrets overview](https://www.browserbase.com/blog/introducing-secrets-in-browserbase-functions) for platform setup.
