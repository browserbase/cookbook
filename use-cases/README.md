# Private workflow examples

Adapt a complete Browserbase workflow, including its application, mock portals, and supporting scripts. Organization names, origin metadata, and captured artifacts have been removed. Keep this collection and its derived artifacts access-controlled.

## Browse by business task

The examples cover finance, business formation, commerce, research, migration, developer infrastructure, public records, healthcare, verification, quality checks, sales and support, and travel.

Use the recipe index below or the [business operations topic](../docs/topics/business-operations.md). Framework and language metadata help identify the closest technical starting point.

## Run an application

Open the selected guide, then its original README and entrypoint. Most projects own a `package.json` or Python manifest. Some need a mock portal server and an agent in separate terminals. A listed `start` script may require a build. Follow the source's process order and configure the local target before starting automation.

Environment samples have secret-like assignments cleared. Supply credentials in an ignored local `.env`. Captured datasets, screenshots, and runtime outputs are excluded. Where a script expects one, provide authorized local input or create a synthetic fixture before execution.

## Status and privacy

These applications span older and newer SDK generations. Neutral sample identifiers separate workflows without associating them with an organization. The cookbook records source inspection rather than claiming successful live runs.

The [workflow overview](UPSTREAM_README.md) and `catalog.json` provide local navigation.

There is no blanket public license for this collection. Read [source provenance](../docs/sources.md) before preparing any public derivative.

## Workflows

<!-- recipes:start -->

| Recipe | Language | Type | Status | Collection |
| --- | --- | --- | --- | --- |
| [1099 Misc](../docs/recipes/use-cases-accounts-payable-and-finance-sample-04-1099-misc.md) | typescript | runnable example | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-accounts-payable-and-finance-sample-05-demo.md) | python | runnable example | current / private | use-cases |
| [Automotive Market Research](../docs/recipes/use-cases-automotive-market-research.md) | javascript | runnable example | current / private | use-cases |
| [Bizfile Payment Handoff](../docs/recipes/use-cases-business-formation-sample-01-bizfile-payment-handoff.md) | shell, typescript | runnable example | current / private | use-cases |
| [Ca Llc Formation](../docs/recipes/use-cases-business-formation-sample-01-ca-llc-formation.md) | typescript | reusable snippet | current / private | use-cases |
| [Irs Ein](../docs/recipes/use-cases-business-formation-sample-01-irs-ein.md) | typescript | runnable example | current / private | use-cases |
| [Competitor Monitor](../docs/recipes/use-cases-commerce-and-market-intel-sample-03-competitor-monitor.md) | typescript | runnable example | current / private | use-cases |
| [Localized Pdp](../docs/recipes/use-cases-commerce-and-market-intel-sample-04-localized-pdp.md) | python | reusable snippet | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-commerce-and-market-intel-sample-05-demo.md) | typescript | runnable example | current / private | use-cases |
| [Pause Inject Resume](../docs/recipes/use-cases-commerce-and-market-intel-sample-06-pause-inject-resume.md) | python | reference | current / private | use-cases |
| [Company News Function](../docs/recipes/use-cases-content-and-research-browserbase-company-news-function.md) | typescript | reusable snippet | current / private | use-cases |
| [Search And Fetch](../docs/recipes/use-cases-content-and-research-sample-02-search-and-fetch.md) | javascript | reusable snippet | current / private | use-cases |
| [Credential Assisted Login](../docs/recipes/use-cases-credential-assisted-login.md) | javascript, python | runnable example | current / private | use-cases |
| [Browserbase Functions](../docs/recipes/use-cases-data-migration-sample-01-browserbase-functions.md) | typescript | reusable snippet | current / private | use-cases |
| [Liveview Login Starter](../docs/recipes/use-cases-data-migration-sample-01-liveview-login-starter.md) | javascript | runnable example | current / private | use-cases |
| [Browser Workflow](../docs/recipes/use-cases-developer-tools-and-infra-browserbase-browser-workflow.md) | javascript | reusable snippet | current / private | use-cases |
| [Example](../docs/recipes/use-cases-developer-tools-and-infra-browserbase-example.md) | typescript | runnable example | current / private | use-cases |
| [Fs Tunnel](../docs/recipes/use-cases-developer-tools-and-infra-browserbase-fs-tunnel.md) | javascript | runnable example | current / private | use-cases |
| [Workflow Recorder](../docs/recipes/use-cases-developer-tools-and-infra-sample-01-workflow-recorder.md) | javascript | runnable example | current / private | use-cases |
| [Caching Demo](../docs/recipes/use-cases-developer-tools-and-infra-stagehand-caching-demo.md) | typescript | runnable example | current / private | use-cases |
| [V4 Demo Kit](../docs/recipes/use-cases-developer-tools-and-infra-stagehand-v4-demo-kit.md) | javascript | runnable example | current / private | use-cases |
| [Employer Enrollment](../docs/recipes/use-cases-government-and-public-records-sample-01-employer-enrollment.md) | typescript | reusable snippet | current / private | use-cases |
| [Context Test](../docs/recipes/use-cases-government-and-public-records-sample-04-context-test.md) | typescript | reusable snippet | current / private | use-cases |
| [Kyb Parallel](../docs/recipes/use-cases-kyc-and-verification-sample-04-kyb-parallel.md) | typescript | runnable example | current / private | use-cases |
| [Qa Agent Demo](../docs/recipes/use-cases-qa-and-observability-browserbase-qa-agent-demo.md) | javascript, typescript | runnable example | current / private | use-cases |
| [Web Perf Vitals](../docs/recipes/use-cases-qa-and-observability-browserbase-web-perf-vitals.md) | typescript | runnable example | current / private | use-cases |
| [Browserbase Benchmark](../docs/recipes/use-cases-qa-and-observability-sample-01-browserbase-benchmark.md) | shell, typescript | runnable example | current / private | use-cases |
| [Login Coverage Diagnostic](../docs/recipes/use-cases-qa-and-observability-sample-02-login-coverage-diagnostic.md) | typescript | runnable example | current / private | use-cases |
| [Browser Trace](../docs/recipes/use-cases-qa-and-observability-sample-03-browser-trace.md) | javascript | runnable example | current / private | use-cases |
| [Localhost Testing](../docs/recipes/use-cases-qa-and-observability-sample-04-localhost-testing.md) | javascript, shell | runnable example | current / private | use-cases |
| [Retail Pricing Intelligence](../docs/recipes/use-cases-retail-pricing-intelligence.md) | javascript | runnable example | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-01-demo.md) | typescript | reusable snippet | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-03-demo.md) | typescript | runnable example | current / private | use-cases |
| [Browserbase Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-05-browserbase-demo.md) | typescript | runnable example | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-06-demo.md) | python | reusable snippet | current / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-09-demo.md) | typescript | runnable example | current / private | use-cases |
| [Opentable Reservations](../docs/recipes/use-cases-travel-and-hospitality-sample-01-opentable-reservations.md) | python | runnable example | current / private | use-cases |
| [Bill Hitl](../docs/recipes/use-cases-accounts-payable-and-finance-browserbase-bill-hitl.md) | typescript | runnable example | legacy / private | use-cases |
| [Billpay](../docs/recipes/use-cases-accounts-payable-and-finance-browserbase-billpay.md) | python, typescript | runnable example | legacy / private | use-cases |
| [Treasury Demo](../docs/recipes/use-cases-accounts-payable-and-finance-sample-01-treasury-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Tax Bill Ap](../docs/recipes/use-cases-accounts-payable-and-finance-sample-02-tax-bill-ap.md) | javascript, shell, typescript | reusable snippet | legacy / private | use-cases |
| [Bill Automation](../docs/recipes/use-cases-accounts-payable-and-finance-sample-03-bill-automation.md) | typescript | runnable example | legacy / private | use-cases |
| [Usps Postmark](../docs/recipes/use-cases-accounts-payable-and-finance-sample-06-usps-postmark.md) | typescript | runnable example | legacy / private | use-cases |
| [Supplier Product Search](../docs/recipes/use-cases-commerce-and-market-intel-sample-01-supplier-product-search.md) | typescript | runnable example | legacy / private | use-cases |
| [Product Data](../docs/recipes/use-cases-commerce-and-market-intel-sample-02-product-data.md) | typescript | runnable example | legacy / private | use-cases |
| [Search Demo](../docs/recipes/use-cases-content-and-research-browserbase-search-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Intelligence Demo](../docs/recipes/use-cases-content-and-research-sample-01-intelligence-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Portal Workflows](../docs/recipes/use-cases-data-migration-sample-01-portal-workflows.md) | typescript | reusable snippet | legacy / private | use-cases |
| [Poc](../docs/recipes/use-cases-developer-tools-and-infra-browserbase-poc.md) | javascript, typescript | reusable snippet | legacy / private | use-cases |
| [Browserbase Demo](../docs/recipes/use-cases-government-and-public-records-sample-02-browserbase-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Tax Portal](../docs/recipes/use-cases-government-and-public-records-sample-03-tax-portal.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-healthcare-and-insurance-sample-01-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-healthcare-and-insurance-sample-02-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-healthcare-and-insurance-sample-03-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Kyc Aml](../docs/recipes/use-cases-kyc-and-verification-sample-01-kyc-aml.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-kyc-and-verification-sample-02-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Company Intel](../docs/recipes/use-cases-kyc-and-verification-sample-03-company-intel.md) | typescript | reusable snippet | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-kyc-and-verification-sample-03-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Linkedin Validator](../docs/recipes/use-cases-kyc-and-verification-sample-03-linkedin-validator.md) | typescript | reusable snippet | legacy / private | use-cases |
| [Qa](../docs/recipes/use-cases-qa-and-observability-browserbase-qa.md) | typescript | reusable snippet | legacy / private | use-cases |
| [Ui Debug Bench](../docs/recipes/use-cases-qa-and-observability-browserbase-ui-debug-bench.md) | javascript, shell, typescript | reusable snippet | legacy / private | use-cases |
| [Support](../docs/recipes/use-cases-sales-support-and-ops-browserbase-support.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-02-demo.md) | javascript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-04-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-07-demo.md) | javascript, typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-08-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Demo](../docs/recipes/use-cases-sales-support-and-ops-sample-10-demo.md) | typescript | runnable example | legacy / private | use-cases |
| [Flight Pricing Benchmark](../docs/recipes/use-cases-travel-and-hospitality-sample-02-flight-pricing-benchmark.md) | typescript | runnable example | legacy / private | use-cases |
| [Flight Booking](../docs/recipes/use-cases-travel-and-hospitality-sample-03-flight-booking.md) | typescript | runnable example | legacy / private | use-cases |

<!-- recipes:end -->
