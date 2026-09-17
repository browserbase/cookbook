# Retail pricing intelligence reference

A provider-neutral architecture note for comparing structured product and checkout observations across operator-configured storefronts. Historical reports and demo files in this directory are unverified trial artifacts retained only as historical context; they are not runnable cookbook recipes and must not be treated as current evidence.

This reference does not claim that any merchant, payment method, anti-bot control, or extraction result has been validated. Supply only targets you are authorized to access, use placeholder or synthetic data during development, and review each target's terms before running automation.

A curated implementation should accept storefront URLs from local configuration, validate HTTPS targets against an explicit allowlist, keep resource identifiers and secrets outside source control, state evidence limitations, require human approval before consequential actions, and store reports outside the source tree with appropriate retention controls.

Use maintained public extraction and human-in-the-loop recipes as starting points for a new implementation.
