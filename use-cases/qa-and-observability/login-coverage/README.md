# Login coverage diagnostic

A generic Browserbase harness for comparing login-page reachability across four placeholder portals. It classifies anti-bot interstitials and can perform a credentialed submit check only when operators provide credentials. The included hosts use reserved example.invalid values; configure only systems you are authorized to test.

This is a demonstration harness, not evidence that any third-party site, authentication flow, captcha, or anti-bot system has been validated. Use it at your own risk and review each target's terms and authorization requirements.

## Quick start

    npm ci
    cp .env.example .env
    npm test
    npm start

The default Verified profile enables a purpose-built fingerprint, a pinned OS, residential proxies, and captcha solving. A baseline profile keeps Verified disabled for controlled comparisons. These settings are examples, not compatibility guarantees.

    npm start all verified
    npm start portal-a
    RETRIES=2 npm start portal-b
    SOLVE_WAIT_MS=75000 npm start portal-c

## Safety and verdicts

The harness submits a login only when both username and password are non-placeholder values. Without them, it visits the configured page, classifies the visible state, records diagnostic evidence, and skips submission.

A reached_login result means only that a usable form was observed. A login_succeeded result requires positive DOM evidence such as logout or account controls and absence of a visible login entry or wall. Neither result proves general site compatibility, account identity, or anti-bot coverage.

Each run writes an output scorecard, JSON results, and screenshots. Replay and live-view links identify diagnostic resources; they are not independent proof of a successful login.

## Configuration

sites.ts contains Portal A-D placeholder records and per-portal proxy or region settings. Replace their reserved URLs and field hints locally. The environment template documents Browserbase keys, an optional persistent context, and blank portal credentials. Do not commit real credentials, production hosts, session identifiers, or captured account data.

Run the synthetic checks with Node.js 24 or newer:

    node --test tests/*.test.mjs

The checks use local fixtures and mocks. They make no live provider or account compatibility claim.
