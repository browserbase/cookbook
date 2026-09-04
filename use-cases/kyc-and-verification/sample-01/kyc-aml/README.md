# SAMPLE_ORG KYC/AML Risk Intelligence Demo

> **Enterprise-grade automated KYC research and risk assessment powered by Browserbase + Stagehand**

This demonstration showcases how Browserbase's cloud browser automation platform can transform KYC (Know Your Customer) and AML (Anti-Money Laundering) compliance workflows. Built specifically for SAMPLE_ORG's Risk Analytics and KYC/AML teams, this demo addresses the key challenges of achieving 80%+ data coverage in customer due diligence research.

## 🎯 Business Problem Solved

SAMPLE_ORG's current KYC process faces several challenges:

| Challenge | Current State | This Solution |
|-----------|--------------|---------------|
| Data Coverage | 40-50% with hyperscalers | 80%+ with automated multi-source research |
| Authenticated Portals | Manual analyst research | Automated registry access |
| Obscure Markets | Limited coverage | Global registry support |
| Audit Trail | Manual documentation | Automatic session recording |
| Processing Time | Hours per entity | Minutes per entity |

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    KYC Research Orchestrator                    │
│                         (src/index.ts)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────────┐
│   Company     │    │  Beneficial   │    │   Adverse Media   │
│   Registry    │    │   Ownership   │    │    Screening      │
│   Research    │    │  Extraction   │    │                   │
└───────────────┘    └───────────────┘    └───────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    ┌───────────────────┐
                    │  PEP & Sanctions  │
                    │     Screening     │
                    └───────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │   Risk Scoring    │
                    │      Engine       │
                    └───────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │   KYC Report +    │
                    │   Audit Trail     │
                    └───────────────────┘
```

## 📦 What's Included

### Research Modules

| Module | Description | Data Sources |
|--------|-------------|--------------|
| `company-registry-research.ts` | Official company data extraction | UK Companies House, OpenCorporates |
| `beneficial-ownership.ts` | PSC/UBO identification | UK PSC Register, Corporate filings |
| `adverse-media-screening.ts` | Negative news detection | Google News, Reuters |
| `pep-sanctions-check.ts` | PEP & sanctions screening | OFAC SDN, UK HM Treasury |
| `risk-scoring-engine.ts` | Multi-factor risk calculation | Aggregated analysis |

### Key Features

- **AI-Powered Automation**: Uses Stagehand's natural language browser automation
- **Multi-Source Aggregation**: Searches 5+ authoritative data sources
- **Session Recording**: Every browser session recorded for compliance audit
- **Structured Output**: JSON reports with Zod schema validation
- **Risk Scoring**: Weighted multi-factor risk assessment (0-100 scale)
- **Full Audit Trail**: Timestamped log of every data retrieval action

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Browserbase account ([sign up](https://browserbase.com))
- Anthropic API key (for Stagehand agent features)

### Installation

```bash
cd kyc-and-verification/sample-01/kyc-aml
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_project_id
ANTHROPIC_API_KEY=your_anthropic_key

# Optional - Demo company
DEMO_COMPANY_NAME=Acme Holdings Ltd
DEMO_JURISDICTION=United Kingdom
```

### Run the Full Demo

```bash
npm start
```

Or specify a target company:

```bash
npm start -- --company "SAMPLE_ORG Holdings PLC" --jurisdiction "United Kingdom"
```

## 📋 Individual Module Demos

Run specific research modules independently:

```bash
# Adverse Media Screening only
npm run demo:adverse-media

# Company Registry Research only
npm run demo:company-registry

# PEP & Sanctions Checks only
npm run demo:pep-sanctions

# Beneficial Ownership only
npm run demo:beneficial-ownership
```

## 📊 Sample Output

### Risk Assessment Summary

```
╔════════════════════════════════════════════════════════════════════╗
║  KYC RESEARCH COMPLETE                                             ║
╠════════════════════════════════════════════════════════════════════╣
║  Company: Acme Holdings Ltd                                        ║
║  Jurisdiction: United Kingdom                                      ║
║                                                                    ║
║  Risk Score: 42/100 (MEDIUM)                                       ║
║                                                                    ║
║  Component Scores:                                                 ║
║  • Adverse Media:        35/100 (weight: 0.20)                     ║
║  • PEP Exposure:         25/100 (weight: 0.20)                     ║
║  • Sanctions Exposure:    0/100 (weight: 0.25)                     ║
║  • Jurisdiction Risk:    20/100 (weight: 0.15)                     ║
║  • Ownership Complexity: 45/100 (weight: 0.10)                     ║
║  • Regulatory Status:    10/100 (weight: 0.10)                     ║
║                                                                    ║
║  Data Completeness: 85%                                            ║
║  Sources Checked: 8                                                ║
║  Audit Trail Entries: 12                                           ║
╚════════════════════════════════════════════════════════════════════╝
```

### JSON Report Structure

```json
{
  "id": "1705234567890-abc123",
  "generatedAt": "2026-01-13T15:30:00.000Z",
  "company": {
    "name": "Acme Holdings Ltd",
    "jurisdiction": "United Kingdom"
  },
  "registryData": {
    "registrationNumber": "12345678",
    "registeredName": "ACME HOLDINGS LIMITED",
    "status": "active",
    "incorporationDate": "2015-03-20",
    "companyType": "Private Limited Company"
  },
  "beneficialOwners": [...],
  "adverseMedia": [...],
  "pepChecks": [...],
  "sanctionsChecks": [...],
  "riskAssessment": {
    "overallRiskScore": 42,
    "riskLevel": "medium",
    "components": {...},
    "recommendations": [...],
    "requiredActions": [...]
  },
  "auditTrail": [...],
  "dataCompleteness": 85
}
```

## 🔒 Compliance & Audit

### Session Recording

Every browser session is automatically recorded by Browserbase. Access recordings via:
- Browserbase Dashboard: `https://www.browserbase.com/sessions/{session_id}`
- Session replay with full DOM capture
- Network request logs
- Screenshot timeline

### Audit Trail

Each research action is logged with:
- Timestamp (ISO 8601)
- Action description
- Data source
- Session ID (links to recording)
- Duration
- Success/failure status
- Error messages (if any)

## 🎛️ Customization

### Adding New Data Sources

1. Create a new module in `src/`:
```typescript
export async function searchNewSource(
  stagehand: Stagehand,
  company: CompanyIdentifier
): Promise<{ data: YourDataType; audit: AuditTrailEntry }> {
  // Implementation
}
```

2. Import in `src/index.ts` and add to the workflow

### Adjusting Risk Weights

Edit `src/risk-scoring-engine.ts`:
```typescript
const components = {
  adverseMedia: { ...calculateAdverseMediaScore(...), weight: 0.25 },  // Increase weight
  sanctionsExposure: { ...calculateSanctionsScore(...), weight: 0.30 }, // Adjust as needed
  // ...
};
```

### Adding Jurisdictions

Edit the high-risk jurisdiction lists in `src/risk-scoring-engine.ts`:
```typescript
const HIGH_RISK_JURISDICTIONS = [
  "iran", "north korea", "syria", // existing
  "new-jurisdiction",             // add new
];
```

## 🏢 SAMPLE_ORG-Specific Use Cases

### KYC/AML Onboarding
- Automate the 7 key questions with ~150 data points each
- Achieve 80%+ coverage vs 40-50% with current solution
- Full audit trail for regulatory compliance

### Risk Analytics (for Clarence's team)
- Automated adverse media monitoring
- PEP relationship mapping
- Cross-border ownership analysis
- Sanctions risk assessment

### Process Automation
- Replace manual CDD analyst research
- Integrate with existing KYC workflow via API
- Batch processing for periodic reviews

## 📈 Scaling for Production

### API Integration

Wrap the KYC workflow as a REST API:
```typescript
import express from 'express';
import { runFullKYCWorkflow } from './index.js';

const app = express();

app.post('/api/kyc/research', async (req, res) => {
  const { companyName, jurisdiction } = req.body;
  const report = await runFullKYCWorkflow({
    company: { name: companyName, jurisdiction },
    // ... config
  });
  res.json(report);
});
```

### Batch Processing

```typescript
const companies = [/* list of companies */];

for (const company of companies) {
  const report = await runFullKYCWorkflow({ company, ...config });
  await saveToDatabase(report);
  await wait(5000); // Rate limiting between companies
}
```

### Integration Points

- **Input**: CRM systems, onboarding forms, periodic review queues
- **Output**: Case management systems, risk dashboards, compliance reports

## 🔧 Troubleshooting

### Common Issues

**"BROWSERBASE_API_KEY is required"**
- Ensure `.env` file exists with valid credentials

**Session timeout errors**
- Some registry sites may be slow; increase timeout in Stagehand config

**No results found**
- Check company name spelling matches official registry
- Try searching with variations (Ltd vs Limited)

### Debug Mode

Run with verbose logging:
```bash
LOG_LEVEL=debug npm start
```

## 📞 Support

For questions about this demo:
- Browserbase Support: support@browserbase.com
- Technical Documentation: https://docs.browserbase.com
- Stagehand Docs: https://github.com/browserbase/stagehand

---

**Built with Browserbase + Stagehand for SAMPLE_ORG Risk Analytics**

*This demo showcases the power of AI-driven browser automation for enterprise compliance workflows. Every session is recorded for audit purposes, ensuring full traceability and compliance with regulatory requirements.*

## Screening completion and unavailable scores

Every configured company/owner check records its entity, source, kind, completion status and audit ID. `sourcesChecked` includes only sources with completed observations. Search failures, unfinished pages, inconsistent extraction results and unidentified PEP subjects remain failed checks; they cannot establish a negative result.

The scoring call requires those records as its final `screeningChecks` argument. Missing, failed, not-run or reused-audit coverage produces a `null` component score and a `null` overall score with `riskLevel: "incomplete"`. JSON retains the checks; console output says unavailable. Partial matches remain in findings and `observedScore`, with review actions, but that partial score is never used to calculate an overall score. Completion percentages count completed screening components, not attempted requests or partial hits. Callers that omit completion evidence remain incomplete.

Completed empty searches mean only that the configured sources reported no matches for the submitted queries. Public-source PEP checks and model-extracted search completion do not establish comprehensive screening or independent identity verification. No-owner inputs make the PEP component not applicable; they do not establish that beneficial ownership research was complete. Historical saved reports are unchanged and do not gain this completion evidence retroactively.

Run `npm test` for typechecking and local synthetic regressions of lookup states, scoring, workflow propagation, saved JSON and console output. These tests do not run screening services or read historical customer reports.

## Registry identity matching

Registry extraction alone does not verify the requested entity. Matched `registryData` now requires the supplied registration number, jurisdiction, and exact registered name (or a supplied approved `alternateNames` entry) to agree with the candidate and its registry detail URL. Name normalization preserves punctuation and legal suffixes; numbers preserve leading zeros. No registration number means the search remains inconclusive, even when the name agrees. Provide `company.registrationNumber` to evaluate identifier agreement.

OpenCorporates searches include the requested jurisdiction code and retain the extracted jurisdiction. Prefer registry codes such as `gb` or `us_de`; unknown textual aliases remain inconclusive. UK/United Kingdom/England and Wales normalize to `gb`. Companies House candidates are also checked against the official detail URL and supplied identifiers. Agreement is a comparison of collected evidence, not independent legal or compliance verification.

Unmatched records remain in `candidates` from registry research and `registryCandidates` in the workflow report; their audit entries explain the inconclusive identity. They are excluded from matched registry data and their numbers are not forwarded into ownership research. The workflow can still perform other research on the original requested company, which has its own evidence limits.

`tests/registry-identity.test.cjs` checks actual search functions, extraction schemas, fallback aggregation and the workflow handoff using synthetic browser/extraction fixtures. No registry, company or provider is contacted.

## Filing-date evidence

Regulatory recency accepts complete calendar dates in `YYYY-MM-DD` or `D Month YYYY` form (full English month names). Parsing validates the actual day/month/year in UTC, including leap years. Missing, malformed, ambiguous numeric, unsupported or future dates produce unknown recency, an incomplete regulatory score and an unavailable overall score; observed company-status warnings remain available separately. Review the source date before scoring recency.

Valid dates use the existing demo thresholds in approximate 30-day months. A recent reported date is not independent proof of a filing, and an old reported date does not establish that no later filings exist. Registry active status also does not independently establish good standing.

`tests/filing-date.test.cjs` uses a fixed synthetic clock to check invalid calendars, future dates, valid leap days, preserved adverse findings and propagation to the overall assessment. No registry or company is contacted.

## Ownership coverage

UK PSC extraction follows visible next-page links for the same company, up to five pages. It merges observed records and stops with incomplete coverage when another page is unavailable, ambiguous, repeated, outside the company path, or beyond the limit. Later failures retain earlier records. An empty page with `hasMorePSCs: true` cannot establish an empty complete owner set. A visible next link also prevents a false model `hasMorePSCs: false` from prematurely ending retrieval.

Ownership output includes `coverage` (`status`, `pagesRead`, `hasMore`, `reason`), saved as `ownershipCoverage` in the report. Partial records remain available for screening, but incomplete coverage makes the ownership and overall score unavailable and does not earn completeness credit. UK results are not replaced by an OpenCorporates fallback that hides partial coverage. OpenCorporates officer extraction retains unestablished ownership coverage rather than claiming a complete PSC register.

Completion here means reaching the end of observed pagination, not independent proof of registry accuracy or completeness. `tests/ownership-pages.test.cjs` runs the actual extractor and next-link callback against synthetic pages; the report regression checks partial coverage through saved JSON and scoring. These tests do not contact a registry or launch a browser.
