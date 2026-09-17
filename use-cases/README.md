# Workflow examples

Adapt complete Browserbase workflows, including applications, mock portals, and supporting scripts. Each example is presented with neutral identifiers and synthetic or operator-supplied inputs.

## Browse by business task

The examples cover finance, business formation, commerce, research, migration, developer infrastructure, public records, healthcare, verification, quality checks, sales and support, and travel.

Use the recipe index below or the [business operations topic](../docs/topics/business-operations.md). Framework and language metadata help identify the closest technical starting point.

## Run an application

Open the selected guide, then its source README and entrypoint. Most projects use a `package.json` or Python manifest. Some need a mock portal server and an agent in separate terminals. A listed `start` script may require a build. Follow the documented process order and configure the local target before starting automation.

Environment samples have secret-like assignments cleared. Supply credentials in an ignored local `.env`. Captured datasets, screenshots, and runtime outputs are excluded. Where a script expects one, provide authorized local input or create a synthetic fixture before execution.

## Compatibility

These applications span older and newer SDK generations. The cookbook records source inspection rather than claiming successful live runs. Review each recipe's verification notes and validate its dependencies and target behavior in your own environment.

The [workflow overview](UPSTREAM_README.md) and `catalog.json` provide additional navigation.

## Workflows

<!-- recipes:start -->

| Recipe | Language | Type | Status | Collection |
| --- | --- | --- | --- | --- |
| [Airline receipt retrieval](../docs/recipes/use-cases-accounts-payable-and-finance-airline-receipt-reference.md) | python | reference | current | use-cases |
| [1099 tax form workflow](../docs/recipes/use-cases-accounts-payable-and-finance-tax-form-1099.md) | typescript | reference | current | use-cases |
| [Automotive Market Research](../docs/recipes/use-cases-automotive-market-research.md) | javascript | reference | current | use-cases |
| [EIN application workflow](../docs/recipes/use-cases-business-formation-ein-application.md) | typescript | reference | current | use-cases |
| [LLC state filing](../docs/recipes/use-cases-business-formation-llc-state-filing.md) | typescript | reference | current | use-cases |
| [State filing payment handoff](../docs/recipes/use-cases-business-formation-state-filing-payment-handoff.md) | shell, typescript | reference | current | use-cases |
| [ERP payment form](../docs/recipes/use-cases-commerce-and-market-intel-erp-payment-form.md) | typescript | runnable example | current | use-cases |
| [Pause inject resume](../docs/recipes/use-cases-commerce-and-market-intel-pause-inject-resume.md) | python | reference | current | use-cases |
| [Search and fetch](../docs/recipes/use-cases-content-and-research-search-and-fetch.md) | javascript | reference | current | use-cases |
| [Credential Assisted Login](../docs/recipes/use-cases-credential-assisted-login.md) | javascript, python | reference | current | use-cases |
| [Functions migration workflow](../docs/recipes/use-cases-data-migration-functions-migration.md) | typescript | reference | current | use-cases |
| [Live session login](../docs/recipes/use-cases-data-migration-live-session-login.md) | javascript | reference | current | use-cases |
| [Caching Demo](../docs/recipes/use-cases-developer-tools-and-infra-stagehand-caching-demo.md) | typescript | reference | current | use-cases |
| [V4 Demo Kit](../docs/recipes/use-cases-developer-tools-and-infra-stagehand-v4-demo-kit.md) | javascript | reference | current | use-cases |
| [Workflow recorder](../docs/recipes/use-cases-developer-tools-and-infra-workflow-recorder.md) | javascript | reference | current | use-cases |
| [Saved context reference](../docs/recipes/use-cases-government-and-public-records-saved-context-reference.md) | typescript | reference | current | use-cases |
| [Parallel business verification](../docs/recipes/use-cases-kyc-and-verification-parallel-business-verification.md) | typescript | reference | current | use-cases |
| [Browser trace](../docs/recipes/use-cases-qa-and-observability-browser-trace.md) | javascript | reference | current | use-cases |
| [Qa Agent Demo](../docs/recipes/use-cases-qa-and-observability-browserbase-qa-agent-demo.md) | javascript, typescript | reference | current | use-cases |
| [Localhost cloud-browser testing reference](../docs/recipes/use-cases-qa-and-observability-localhost-testing.md) | javascript, shell | reference | current | use-cases |
| [Multi-portal login coverage reference](../docs/recipes/use-cases-qa-and-observability-login-coverage.md) | typescript | reference | current | use-cases |
| [Retail payment research reference](../docs/recipes/use-cases-retail-pricing-intelligence.md) | javascript | reference | current | use-cases |
| [Job site browser starter](../docs/recipes/use-cases-sales-support-and-ops-job-site-browser.md) | typescript | runnable example | current | use-cases |
| [Registry form processing](../docs/recipes/use-cases-sales-support-and-ops-registry-form-processing.md) | typescript | runnable example | current | use-cases |
| [Restaurant reservation function](../docs/recipes/use-cases-sales-support-and-ops-restaurant-reservation.md) | typescript | reusable snippet | current | use-cases |
| [Supply chain portal login](../docs/recipes/use-cases-sales-support-and-ops-supply-chain-login.md) | python | reusable snippet | current | use-cases |
| [Voice context workflow](../docs/recipes/use-cases-sales-support-and-ops-voice-context-workflow.md) | typescript | reference | current | use-cases |
| [Restaurant reservation pattern](../docs/recipes/use-cases-travel-and-hospitality-restaurant-reservation-pattern.md) | python | reference | current | use-cases |
| [Payment checkout reference](../docs/recipes/use-cases-accounts-payable-and-finance-payment-checkout.md) | python, typescript | reference | legacy | use-cases |
| [Synthetic payment verification handoff](../docs/recipes/use-cases-accounts-payable-and-finance-payment-verification-handoff.md) | typescript | reference | legacy | use-cases |
| [Postal evidence reference](../docs/recipes/use-cases-accounts-payable-and-finance-postal-evidence-reference.md) | typescript | reference | legacy | use-cases |
| [Property tax document workflow](../docs/recipes/use-cases-accounts-payable-and-finance-property-tax-document.md) | javascript, shell, typescript | reference | legacy | use-cases |
| [Telecom invoice automation](../docs/recipes/use-cases-accounts-payable-and-finance-telecom-invoice-automation.md) | typescript | reference | legacy | use-cases |
| [Synthetic treasury workflow](../docs/recipes/use-cases-accounts-payable-and-finance-treasury-workflow.md) | typescript | reference | legacy | use-cases |
| [Product data extraction](../docs/recipes/use-cases-commerce-and-market-intel-product-data-extraction.md) | typescript | reference | legacy | use-cases |
| [Supplier research workflow](../docs/recipes/use-cases-commerce-and-market-intel-supplier-research.md) | typescript | reference | legacy | use-cases |
| [News intelligence workflow](../docs/recipes/use-cases-content-and-research-news-intelligence.md) | typescript | reference | legacy | use-cases |
| [Portal migration workflows](../docs/recipes/use-cases-data-migration-portal-migration.md) | typescript | reference | legacy | use-cases |
| [Agency form workflow](../docs/recipes/use-cases-government-and-public-records-agency-form-workflow.md) | typescript | reference | legacy | use-cases |
| [Property tax portal](../docs/recipes/use-cases-government-and-public-records-property-tax-portal.md) | typescript | reference | legacy | use-cases |
| [Health portal login](../docs/recipes/use-cases-healthcare-and-insurance-health-portal-login.md) | typescript | runnable example | legacy | use-cases |
| [License verification](../docs/recipes/use-cases-healthcare-and-insurance-license-verification.md) | typescript | runnable example | legacy | use-cases |
| [Provider search with human handoff](../docs/recipes/use-cases-healthcare-and-insurance-provider-search-handoff.md) | typescript | runnable example | legacy | use-cases |
| [Authenticated portal navigation](../docs/recipes/use-cases-kyc-and-verification-authenticated-portal-navigation.md) | typescript | runnable example | legacy | use-cases |
| [Business code classification](../docs/recipes/use-cases-kyc-and-verification-business-code-classification.md) | typescript | runnable example | legacy | use-cases |
| [Business entity research](../docs/recipes/use-cases-kyc-and-verification-business-entity-research.md) | typescript | reference | legacy | use-cases |
| [KYC AML screening](../docs/recipes/use-cases-kyc-and-verification-kyc-aml-screening.md) | typescript | reference | legacy | use-cases |
| [Qa](../docs/recipes/use-cases-qa-and-observability-browserbase-qa.md) | typescript | reference | legacy | use-cases |
| [Ui Debug Bench](../docs/recipes/use-cases-qa-and-observability-browserbase-ui-debug-bench.md) | javascript, shell, typescript | reference | legacy | use-cases |
| [Support](../docs/recipes/use-cases-sales-support-and-ops-browserbase-support.md) | typescript | reference | legacy | use-cases |
| [Mortgage rate extraction](../docs/recipes/use-cases-sales-support-and-ops-mortgage-rate-extraction.md) | javascript | runnable example | legacy | use-cases |
| [Navigation context checkout](../docs/recipes/use-cases-sales-support-and-ops-navigation-context-checkout.md) | typescript | runnable example | legacy | use-cases |
| [Real estate research agent](../docs/recipes/use-cases-sales-support-and-ops-real-estate-research.md) | javascript, typescript | runnable example | legacy | use-cases |
| [Stock price extraction](../docs/recipes/use-cases-sales-support-and-ops-stock-price-extraction.md) | typescript | runnable example | legacy | use-cases |
| [Flight booking](../docs/recipes/use-cases-travel-and-hospitality-flight-booking.md) | typescript | reference | legacy | use-cases |
| [Flight pricing benchmark](../docs/recipes/use-cases-travel-and-hospitality-flight-pricing-benchmark.md) | typescript | reference | legacy | use-cases |

<!-- recipes:end -->
