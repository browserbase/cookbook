import { config } from "dotenv";
import type {
  CompanyIdentifier,
  KYCReport,
  AuditTrailEntry,
  DemoConfig,
} from "./types.js";
import { log, generateId, formatDuration } from "./utils.js";
import { screenAdverseMedia } from "./adverse-media-screening.js";
import { researchCompanyRegistry } from "./company-registry-research.js";
import { screenPEPSanctions } from "./pep-sanctions-check.js";
import { extractBeneficialOwnership } from "./beneficial-ownership.js";
import { calculateRiskAssessment } from "./risk-scoring-engine.js";
import * as fs from "fs";
import * as path from "path";

config();

// ============================================================
// SAMPLE_ORG KYC/AML Risk Intelligence Demo
// Main Orchestrator
// ============================================================
// This is the entry point for the full KYC research workflow.
// It coordinates all research modules and produces a comprehensive
// risk assessment report with full audit trail.
// ============================================================

/**
 * Parse command line arguments
 */
function parseArgs(): DemoConfig {
  const args = process.argv.slice(2);

  const config: DemoConfig = {
    company: {
      name: process.env.DEMO_COMPANY_NAME || "Acme Holdings Ltd",
      jurisdiction: process.env.DEMO_JURISDICTION || "United Kingdom",
    },
    enableSessionRecording: process.env.ENABLE_SESSION_RECORDING !== "false",
    maxConcurrentSearches: parseInt(process.env.MAX_CONCURRENT_SEARCHES || "3"),
    logLevel: (process.env.LOG_LEVEL as DemoConfig["logLevel"]) || "info",
    outputFormat: "both",
  };

  // Parse --company "Name" --jurisdiction "Country" flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--company" && args[i + 1]) {
      config.company.name = args[i + 1];
      i++;
    } else if (args[i] === "--jurisdiction" && args[i + 1]) {
      config.company.jurisdiction = args[i + 1];
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      config.outputFormat = args[i + 1] as DemoConfig["outputFormat"];
      i++;
    } else if (args[i] === "--mode" && args[i + 1] === "full") {
      // Full mode - run all modules (default behavior)
      i++;
    }
  }

  return config;
}

/**
 * Display demo banner
 */
function displayBanner(company: CompanyIdentifier) {
  console.log("\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "║     🔍  SAMPLE_ORG KYC/AML Risk Intelligence Demo                        ║",
  );
  console.log(
    "║     Powered by Browserbase + Stagehand                             ║",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(`║  Target: ${company.name.padEnd(55)}║`);
  console.log(`║  Jurisdiction: ${company.jurisdiction.padEnd(49)}║`);
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "║  This demo will:                                                   ║",
  );
  console.log(
    "║  • Search company registries for official data                     ║",
  );
  console.log(
    "║  • Extract beneficial ownership information                        ║",
  );
  console.log(
    "║  • Screen for adverse media across news sources                    ║",
  );
  console.log(
    "║  • Check PEP databases and sanctions lists                         ║",
  );
  console.log(
    "║  • Generate a comprehensive risk assessment                        ║",
  );
  console.log(
    "║  • Provide a full audit trail for compliance                       ║",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════════╝",
  );
  console.log("\n");
}

/**
 * Save report to file
 */
function saveReport(report: KYCReport, outputDir: string = "./reports") {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const companySlug = report.company.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");
  const filename = `kyc-report-${companySlug}-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  return filepath;
}

/**
 * Main KYC research workflow
 */
async function runFullKYCWorkflow(config: DemoConfig): Promise<KYCReport> {
  const startTime = Date.now();
  const reportId = generateId();
  const auditTrail: AuditTrailEntry[] = [];
  const dataSources: string[] = [];
  const analysisNotes: string[] = [];

  displayBanner(config.company);

  log.info("Starting comprehensive KYC research workflow...");
  log.info(`Report ID: ${reportId}`);
  console.log("");

  // ============================================================
  // PHASE 1: Company Registry Research
  // ============================================================
  log.info("Phase 1/4: Company Registry Research");
  const registryResult = await researchCompanyRegistry(config.company);
  auditTrail.push(...registryResult.auditTrail);
  if (registryResult.sourceRegistry) {
    dataSources.push(registryResult.sourceRegistry);
  }
  if (registryResult.data) {
    analysisNotes.push(
      `Registry identity fields matched: ${registryResult.data.registeredName} (${registryResult.data.status})`,
    );
  }

  if (!registryResult.data) {
    analysisNotes.push("Registry identity inconclusive; no extracted candidate number is forwarded to ownership research.");
  }

  // ============================================================
  // PHASE 2: Beneficial Ownership Extraction
  // ============================================================
  console.log("\n");
  log.info("Phase 2/4: Beneficial Ownership Extraction");
  const ownershipResult = await extractBeneficialOwnership(
    config.company,
    registryResult.data?.registrationNumber,
  );
  auditTrail.push(...ownershipResult.auditTrail);
  if (ownershipResult.sourceRegistry) {
    dataSources.push(ownershipResult.sourceRegistry);
  }
  analysisNotes.push(`Ownership: ${ownershipResult.ownershipStructure}`);

  // ============================================================
  // PHASE 3: Adverse Media Screening
  // ============================================================
  console.log("\n");
  log.info("Phase 3/4: Adverse Media Screening");
  const adverseMediaResult = await screenAdverseMedia(config.company);
  auditTrail.push(...adverseMediaResult.auditTrail);
  dataSources.push(...adverseMediaResult.sources);
  const negativeArticles = adverseMediaResult.results.filter(
    (r) => r.sentiment === "negative",
  );
  analysisNotes.push(
    `Adverse media: ${negativeArticles.length} negative articles found across ${adverseMediaResult.sources.length} sources`,
  );

  // ============================================================
  // PHASE 4: PEP & Sanctions Screening
  // ============================================================
  console.log("\n");
  log.info("Phase 4/4: PEP & Sanctions Screening");
  const pepSanctionsResult = await screenPEPSanctions(
    config.company,
    ownershipResult.owners,
  );
  auditTrail.push(...pepSanctionsResult.auditTrail);
  dataSources.push(...pepSanctionsResult.sourcesChecked);
  const pepHits = pepSanctionsResult.pepResults.filter((r) => r.isPEP);
  const sanctionsHits = pepSanctionsResult.sanctionsResults;
  analysisNotes.push(
    `Observed PEP matches: ${pepHits.length} | Observed sanctions matches: ${sanctionsHits.length} | Completed checks: ${pepSanctionsResult.checks.filter(check => check.status === "completed").length}/${pepSanctionsResult.checks.length}`,
  );

  // ============================================================
  // PHASE 5: Risk Assessment
  // ============================================================
  console.log("\n");
  log.info("Phase 5/5: Risk Assessment & Scoring");
  const riskAssessment = calculateRiskAssessment(
    config.company,
    adverseMediaResult.results,
    pepSanctionsResult.pepResults,
    pepSanctionsResult.sanctionsResults,
    ownershipResult.owners,
    ownershipResult.complexityScore,
    registryResult.data,
    reportId,
    pepSanctionsResult.checks,
    ownershipResult.coverage,
  );

  // ============================================================
  // Calculate Data Completeness
  // ============================================================
  const totalDataPoints = 10; // Key data points we try to collect
  let collectedDataPoints = 0;

  if (registryResult.data) collectedDataPoints += 2; // Registry found + status
  if (ownershipResult.owners.length > 0 && ownershipResult.coverage?.status === "completed") collectedDataPoints += 2;
  if (adverseMediaResult.results.length > 0) collectedDataPoints += 2;
  if (riskAssessment.components.pepExposure.status === "completed") collectedDataPoints += 2;
  if (riskAssessment.components.sanctionsExposure.status === "completed") collectedDataPoints += 2;

  const dataCompleteness = Math.round(
    (collectedDataPoints / totalDataPoints) * 100,
  );

  // ============================================================
  // Build Final Report
  // ============================================================
  const report: KYCReport = {
    id: reportId,
    generatedAt: new Date().toISOString(),
    company: config.company,
    registryData: registryResult.data,
    registryCandidates: registryResult.candidates,
    beneficialOwners: ownershipResult.owners,
    ownershipCoverage: ownershipResult.coverage,
    adverseMedia: adverseMediaResult.results,
    pepChecks: pepSanctionsResult.pepResults,
    sanctionsChecks: pepSanctionsResult.sanctionsResults,
    riskAssessment,
    auditTrail,
    dataSources: [...new Set(dataSources)],
    dataCompleteness,
    analysisNotes,
  };

  // ============================================================
  // Final Summary
  // ============================================================
  const duration = Date.now() - startTime;

  log.section(riskAssessment.riskLevel === "incomplete" ? "KYC SCREENING INCOMPLETE" : "KYC RESEARCH OUTPUT");
  log.data("Report ID", reportId);
  log.data("Duration", formatDuration(duration));
  log.data("Data Sources", report.dataSources.length.toString());
  log.data("Audit Trail Entries", auditTrail.length.toString());
  log.data("Data Completeness", `${dataCompleteness}%`);
  console.log("");
  log.riskScore(riskAssessment.overallRiskScore, riskAssessment.riskLevel);

  // Save report
  if (config.outputFormat === "json" || config.outputFormat === "both") {
    const filepath = saveReport(report);
    log.success(`Report saved to: ${filepath}`);
  }

  console.log("\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    riskAssessment.riskLevel === "incomplete"
      ? "║  Screening incomplete: follow-up required                         ║"
      : "║  Research output generated; review required                      ║",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "║  All browser sessions were recorded for compliance audit.          ║",
  );
  console.log(
    "║  Session recordings are available in your Browserbase dashboard.  ║",
  );
  console.log(
    "║                                                                    ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════════╝",
  );
  console.log("\n");

  return report;
}

/**
 * Main entry point
 */
async function main() {
  // Check for required environment variables
  if (!process.env.BROWSERBASE_API_KEY) {
    console.error(
      "Error: BROWSERBASE_API_KEY environment variable is required",
    );
    console.error("Please copy .env.example to .env and add your credentials");
    process.exit(1);
  }

  if (!process.env.BROWSERBASE_PROJECT_ID) {
    console.error(
      "Error: BROWSERBASE_PROJECT_ID environment variable is required",
    );
    console.error("Please copy .env.example to .env and add your credentials");
    process.exit(1);
  }

  const config = parseArgs();

  try {
    const report = await runFullKYCWorkflow(config);

    // Output final JSON if requested
    if (config.outputFormat === "json") {
      console.log(JSON.stringify(report, null, 2));
    }
  } catch (error) {
    console.error("Fatal error during KYC workflow:", error);
    process.exit(1);
  }
}

// Export for module use
export { runFullKYCWorkflow };
export type { DemoConfig, KYCReport };

// Run main
main().catch(console.error);
