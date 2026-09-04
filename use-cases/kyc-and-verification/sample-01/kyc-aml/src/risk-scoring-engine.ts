import { config } from "dotenv";
import type {
  CompanyIdentifier,
  RiskAssessment,
  RiskScoreComponent,
  AdverseMediaResult,
  PEPCheckResult,
  SanctionsCheckResult,
  BeneficialOwner,
  CompanyRegistryData,
  AuditTrailEntry,
  ScreeningCheck,
} from "./types.js";
import {
  log,
  generateId,
  calculateOverallRisk,
  generateRecommendations,
} from "./utils.js";

config();

// ============================================================
// Risk Scoring Engine
// ============================================================
// Aggregates findings from all research modules and calculates
// a comprehensive risk score with component breakdowns.
// ============================================================

/**
 * High-risk jurisdictions for KYC/AML purposes
 * Based on FATF grey list and common risk assessments
 */
const HIGH_RISK_JURISDICTIONS = [
  "iran",
  "north korea",
  "syria",
  "myanmar",
  "russia",
  "belarus",
  "cayman islands",
  "british virgin islands",
  "panama",
  "seychelles",
  "vanuatu",
  "yemen",
  "south sudan",
  "libya",
  "somalia",
];

const MEDIUM_RISK_JURISDICTIONS = [
  "turkey",
  "pakistan",
  "nigeria",
  "philippines",
  "vietnam",
  "united arab emirates",
  "dubai",
  "malta",
  "cyprus",
  "gibraltar",
  "jersey",
  "guernsey",
  "isle of man",
  "luxembourg",
  "liechtenstein",
];

/**
 * Calculate adverse media risk score
 */
function calculateAdverseMediaScore(
  results: AdverseMediaResult[],
): RiskScoreComponent {
  let score = 0;
  const findings: string[] = [];
  const sources: string[] = [];

  const negativeArticles = results.filter((r) => r.sentiment === "negative");
  const highRelevanceArticles = results.filter((r) => r.relevanceScore >= 70);

  // Base score from number of negative articles
  score += Math.min(negativeArticles.length * 10, 40);

  // High relevance increases score
  score += Math.min(highRelevanceArticles.length * 5, 20);

  // Critical risk categories
  const criticalCategories = ["sanctions", "money_laundering", "fraud"];
  const criticalHits = negativeArticles.filter((r) =>
    criticalCategories.includes(r.riskCategory),
  );
  score += criticalHits.length * 15;

  // Add findings
  if (negativeArticles.length > 0) {
    findings.push(`${negativeArticles.length} negative media articles found`);
  }
  if (criticalHits.length > 0) {
    findings.push(
      `${criticalHits.length} articles in critical risk categories`,
    );
  }

  // Collect unique sources
  const uniqueSources = [...new Set(results.map((r) => r.source))];
  sources.push(...uniqueSources);

  if (findings.length === 0) {
    findings.push("No significant adverse media found");
  }

  return {
    category: "Adverse Media",
    score: Math.min(score, 100),
    weight: 0.2,
    findings,
    sources,
  };
}

/**
 * Calculate PEP exposure risk score
 */
function calculatePEPScore(results: PEPCheckResult[]): RiskScoreComponent {
  let score = 0;
  const findings: string[] = [];
  const sources: string[] = [];

  const pepHits = results.filter((r) => r.isPEP);

  for (const pep of pepHits) {
    // Base score for any PEP
    score += 25;

    // Higher risk for certain PEP types
    if (pep.pepType === "domestic") score += 10;
    if (pep.pepType === "foreign") score += 15;
    if (pep.level === "national") score += 10;

    // Currently active PEPs are higher risk
    if (!pep.dateEnded) score += 15;

    findings.push(
      `${pep.name}: ${pep.position || "Political position"} (${pep.country || "Unknown country"})`,
    );
    if (pep.source) sources.push(pep.source);
  }

  if (pepHits.length === 0) {
    findings.push("No PEP connections identified");
  }

  // Collect unique sources
  const uniqueSources = [...new Set(sources)];

  return {
    category: "PEP Exposure",
    score: Math.min(score, 100),
    weight: 0.2,
    findings,
    sources: uniqueSources,
  };
}

/**
 * Calculate sanctions exposure risk score
 */
function calculateSanctionsScore(
  results: SanctionsCheckResult[],
): RiskScoreComponent {
  let score = 0;
  const findings: string[] = [];
  const sources: string[] = [];

  if (results.length === 0) {
    return {
      category: "Sanctions",
      score: 0,
      weight: 0.25,
      findings: ["No sanctions matches found"],
      sources: ["OFAC", "UK HM Treasury"],
    };
  }

  // Any sanctions hit is critical
  for (const hit of results) {
    // High match scores are more concerning
    if (hit.matchScore >= 90) {
      score += 50;
      findings.push(
        `HIGH MATCH (${hit.matchScore}%): ${hit.entityName} on ${hit.sanctionsList}`,
      );
    } else if (hit.matchScore >= 70) {
      score += 30;
      findings.push(
        `MEDIUM MATCH (${hit.matchScore}%): ${hit.entityName} on ${hit.sanctionsList}`,
      );
    } else {
      score += 15;
      findings.push(
        `LOW MATCH (${hit.matchScore}%): ${hit.entityName} on ${hit.sanctionsList}`,
      );
    }

    sources.push(hit.sanctionsBody);
  }

  const uniqueSources = [...new Set(sources)];

  return {
    category: "Sanctions",
    score: Math.min(score, 100),
    weight: 0.25, // Highest weight - sanctions are critical
    findings,
    sources: uniqueSources,
  };
}

/**
 * Calculate jurisdiction risk score
 */
function calculateJurisdictionScore(
  company: CompanyIdentifier,
  owners: BeneficialOwner[],
): RiskScoreComponent {
  let score = 0;
  const findings: string[] = [];
  const sources: string[] = ["FATF Risk Assessment"];

  const jurisdictionLower = company.jurisdiction.toLowerCase();

  // Check company jurisdiction
  if (HIGH_RISK_JURISDICTIONS.some((j) => jurisdictionLower.includes(j))) {
    score += 60;
    findings.push(
      `Company registered in high-risk jurisdiction: ${company.jurisdiction}`,
    );
  } else if (
    MEDIUM_RISK_JURISDICTIONS.some((j) => jurisdictionLower.includes(j))
  ) {
    score += 30;
    findings.push(
      `Company registered in medium-risk jurisdiction: ${company.jurisdiction}`,
    );
  } else {
    findings.push(
      `Company jurisdiction: ${company.jurisdiction} (standard risk)`,
    );
  }

  // Check owner nationalities
  for (const owner of owners) {
    const nationalityLower = (owner.nationality || "").toLowerCase();
    if (HIGH_RISK_JURISDICTIONS.some((j) => nationalityLower.includes(j))) {
      score += 20;
      findings.push(
        `Beneficial owner from high-risk jurisdiction: ${owner.name} (${owner.nationality})`,
      );
    } else if (
      MEDIUM_RISK_JURISDICTIONS.some((j) => nationalityLower.includes(j))
    ) {
      score += 10;
      findings.push(
        `Beneficial owner from medium-risk jurisdiction: ${owner.name} (${owner.nationality})`,
      );
    }
  }

  if (
    findings.length === 1 &&
    !findings[0].includes("high-risk") &&
    !findings[0].includes("medium-risk")
  ) {
    findings.push("No high-risk jurisdiction exposure identified");
  }

  return {
    category: "Jurisdiction Risk",
    score: Math.min(score, 100),
    weight: 0.15,
    findings,
    sources,
  };
}

/**
 * Calculate ownership complexity score
 */
function calculateOwnershipComplexityScore(
  owners: BeneficialOwner[],
  complexityScore: number,
): RiskScoreComponent {
  let score = complexityScore; // Start with pre-calculated complexity
  const findings: string[] = [];
  const sources: string[] = ["Company Registry Analysis"];

  // Analyze ownership characteristics
  const corporateOwners = owners.filter(
    (o) =>
      o.name.toLowerCase().includes("ltd") ||
      o.name.toLowerCase().includes("limited") ||
      o.name.toLowerCase().includes("inc") ||
      o.name.toLowerCase().includes("corp") ||
      o.ownershipPercentage === "Parent Company",
  );

  if (corporateOwners.length > 0) {
    findings.push(
      `${corporateOwners.length} corporate owner(s) in structure (layered ownership)`,
    );
    score += 10;
  }

  // Multiple individuals with similar ownership suggests distributed control
  const individualOwners = owners.filter((o) => !corporateOwners.includes(o));
  if (individualOwners.length > 3) {
    findings.push(
      `${individualOwners.length} individual beneficial owners (complex control)`,
    );
    score += 10;
  }

  // Missing ownership percentages
  const missingPercentages = owners.filter((o) => !o.ownershipPercentage);
  if (missingPercentages.length > 0) {
    findings.push(
      `${missingPercentages.length} owner(s) with unspecified ownership percentage`,
    );
    score += 5;
  }

  if (owners.length === 0) {
    findings.push(
      "No beneficial ownership information available (high uncertainty)",
    );
    score = 80; // Unknown ownership is high risk
  } else if (owners.length === 1 && !corporateOwners.includes(owners[0])) {
    findings.push("Simple ownership structure: single individual owner");
    score = Math.max(score - 20, 0);
  } else {
    findings.push(`${owners.length} beneficial owner(s) identified`);
  }

  return {
    category: "Ownership Complexity",
    score: Math.min(score, 100),
    weight: 0.1,
    findings,
    sources,
  };
}

/**
 * Calculate regulatory status score
 */
function parseFilingDate(value: string | null): number | null {
  if (!value) return null;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const named = text.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const year = iso ? Number(iso[1]) : named ? Number(named[3]) : 0;
  const month = iso ? Number(iso[2]) : named ? months.indexOf(named[2].toLowerCase()) + 1 : 0;
  const day = iso ? Number(iso[3]) : named ? Number(named[1]) : 0;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function calculateRegulatoryScore(
  registryData: CompanyRegistryData | null,
): RiskScoreComponent {
  let score = 0;
  const findings: string[] = [];
  const sources: string[] = [];

  if (!registryData) {
    return {
      category: "Regulatory Status",
      score: 50,
      weight: 0.1,
      findings: [
        "Company registry data not available (unable to verify status)",
      ],
      sources: ["Unable to verify"],
    };
  }

  sources.push(registryData.sourceRegistry);

  // Check company status
  if (registryData.status === "active") {
    findings.push("Registry reports active status; good standing is not independently established");
  } else if (registryData.status === "dissolved") {
    score += 80;
    findings.push("ALERT: Company is dissolved");
  } else if (registryData.status === "liquidation") {
    score += 70;
    findings.push("ALERT: Company is in liquidation");
  } else {
    score += 30;
    findings.push(`Company status unknown: ${registryData.status}`);
  }

  const lastFiling = parseFilingDate(registryData.lastFilingDate);
  const now = Date.now();
  if (lastFiling === null || lastFiling > now) {
    findings.push(lastFiling !== null
      ? "Filing recency unknown: reported filing date is in the future"
      : "Filing recency unknown: date is missing, invalid or unsupported");
    return {
      category: "Regulatory Status", score: null, observedScore: Math.min(score, 100),
      status: "incomplete", weight: 0.1, findings, sources,
    };
  }
  const monthsAgo = Math.floor((now - lastFiling) / (1000 * 60 * 60 * 24 * 30));
  if (monthsAgo > 24) {
    score += 25;
    findings.push(`Last reported filing was ${monthsAgo} approximate months ago; later filings have not been independently ruled out`);
  } else if (monthsAgo > 12) {
    score += 10;
    findings.push(`Last reported filing ${monthsAgo} approximate months ago`);
  } else {
    findings.push("Reported filing date is within the demo's recent-activity interval");
  }

  return {
    category: "Regulatory Status",
    score: Math.min(score, 100),
    status: "completed",
    weight: 0.1,
    findings,
    sources,
  };
}

/**
 * Generate required actions based on risk level
 */
function generateRequiredActions(
  riskLevel: string,
  components: Record<string, RiskScoreComponent>,
): string[] {
  const actions: string[] = [];
  if (components.ownershipComplexity?.status === "incomplete") {
    actions.push("Complete ownership pagination or review missing records before relying on the owner set");
  }
  if (components.regulatoryStatus?.status === "incomplete") {
    actions.push("Validate the reported filing date against the registry before scoring regulatory recency");
  }

  if (riskLevel === "incomplete") {
    actions.push("STOP: Screening incomplete; complete missing or failed source checks before an onboarding decision");
  } else if (riskLevel === "critical") {
    actions.push(
      "STOP: Do not proceed with onboarding until all issues resolved",
    );
    actions.push("Escalate to Compliance Officer immediately");
    actions.push("Request SAR/STR review if sanctions match confirmed");
  } else if (riskLevel === "high") {
    actions.push("Enhanced Due Diligence (EDD) required");
    actions.push("Senior management approval required for onboarding");
    actions.push("Implement enhanced transaction monitoring");
  } else if (riskLevel === "medium") {
    actions.push("Standard Enhanced Due Diligence procedures apply");
    actions.push("Document all findings in customer file");
    actions.push("Schedule 6-month periodic review");
  } else {
    actions.push("Standard Customer Due Diligence (CDD) procedures apply");
    actions.push("Annual periodic review sufficient");
  }

  // Specific actions based on component findings
  if ((components.sanctionsExposure?.observedScore ?? components.sanctionsExposure?.score ?? 0) > 0) {
    actions.push(
      "Manual review of sanctions matches by Compliance team required",
    );
  }
  if ((components.pepExposure?.observedScore ?? components.pepExposure?.score ?? 0) > 30) {
    actions.push("Obtain source of wealth documentation for PEP relationships");
  }
  if ((components.ownershipComplexity?.observedScore ?? components.ownershipComplexity?.score ?? 0) > 50) {
    actions.push("Request certified beneficial ownership documentation");
  }

  return actions;
}

function applyScreeningCoverage(
  component: RiskScoreComponent,
  required: Pick<ScreeningCheck, "entity" | "source" | "kind">[],
  checks: ScreeningCheck[],
): RiskScoreComponent {
  if (required.length === 0) return { ...component, score: 0, status: "not_applicable", findings: ["No beneficial owners supplied for PEP screening"], sources: [] };
  const remaining = [...checks];
  const usedAudits = new Set<string>();
  const completed: ScreeningCheck[] = [];
  for (const expected of required) {
    const index = remaining.findIndex(check => check.entity === expected.entity && check.source === expected.source && check.kind === expected.kind);
    if (index < 0) continue;
    const [check] = remaining.splice(index, 1);
    if (check.status === "completed" && check.auditId && !usedAudits.has(check.auditId)) {
      completed.push(check);
      usedAudits.add(check.auditId);
    }
  }
  const sources = [...new Set(completed.map(check => check.source))];
  if (completed.length !== required.length) {
    return { ...component, score: null, observedScore: component.score ?? undefined, status: "incomplete", sources,
      findings: ["Required screening incomplete; absence of matches cannot be established", ...(component.score ? component.findings : [])] };
  }
  return { ...component, status: "completed", sources,
    findings: component.score === 0 ? ["No matches reported by the completed configured checks; this is not comprehensive clearance"] : component.findings };
}

/**
 * Main risk assessment function
 * Aggregates all findings into a comprehensive risk score
 */
export function calculateRiskAssessment(
  company: CompanyIdentifier,
  adverseMedia: AdverseMediaResult[],
  pepResults: PEPCheckResult[],
  sanctionsResults: SanctionsCheckResult[],
  owners: BeneficialOwner[],
  ownershipComplexity: number,
  registryData: CompanyRegistryData | null,
  auditTrailId: string,
  screeningChecks: ScreeningCheck[] = [],
  ownershipCoverage?: { status: "completed" | "incomplete"; reason: string },
): RiskAssessment {
  log.section("RISK SCORING ENGINE");
  log.data("Company", company.name);

  // Calculate all component scores
  const components = {
    adverseMedia: calculateAdverseMediaScore(adverseMedia),
    pepExposure: calculatePEPScore(pepResults),
    sanctionsExposure: calculateSanctionsScore(sanctionsResults),
    jurisdictionRisk: calculateJurisdictionScore(company, owners),
    ownershipComplexity: calculateOwnershipComplexityScore(
      owners,
      ownershipComplexity,
    ),
    regulatoryStatus: calculateRegulatoryScore(registryData),
  };

  const sanctionsRequired: Pick<ScreeningCheck, "entity" | "source" | "kind">[] = [
    { entity: company.name, source: "OFAC", kind: "sanctions" },
    { entity: company.name, source: "UK", kind: "sanctions" },
    ...owners.map(owner => ({ entity: owner.name, source: "OFAC" as const, kind: "sanctions" as const })),
  ];
  components.sanctionsExposure = applyScreeningCoverage(components.sanctionsExposure, sanctionsRequired, screeningChecks);
  components.pepExposure = applyScreeningCoverage(components.pepExposure,
    owners.map(owner => ({ entity: owner.name, source: "Public PEP", kind: "pep" })), screeningChecks);

  if (ownershipCoverage?.status === "incomplete") {
    components.ownershipComplexity = { ...components.ownershipComplexity,
      observedScore: components.ownershipComplexity.score ?? undefined, score: null, status: "incomplete",
      findings: [`Ownership coverage incomplete: ${ownershipCoverage.reason}`, ...components.ownershipComplexity.findings] };
  }

  // Calculate overall risk
  const { score, level } = calculateOverallRisk(components);

  // Generate recommendations and required actions
  const recommendations = generateRecommendations({
    components,
  } as Partial<RiskAssessment>);
  const requiredActions = generateRequiredActions(level, components);

  // Build final assessment
  const assessment: RiskAssessment = {
    companyId: company,
    overallRiskScore: score,
    riskLevel: level,
    components,
    recommendations,
    requiredActions,
    timestamp: new Date().toISOString(),
    auditTrailId,
    screeningChecks,
  };

  // Display results
  log.subsection("Risk Score Breakdown");
  Object.entries(components).forEach(([key, component]) => {
    const label = key.replace(/([A-Z])/g, " $1").trim();
    console.log(
      `  ${label}: ${component.score === null ? "UNAVAILABLE" : `${component.score}/100`} (weight: ${component.weight})`,
    );
  });

  console.log("");
  log.riskScore(score, level);

  log.subsection("Key Findings");
  Object.values(components).forEach((component) => {
    component.findings.forEach((finding) => {
      console.log(`  • ${finding}`);
    });
  });

  log.subsection("Recommendations");
  recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });

  log.subsection("Required Actions");
  requiredActions.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action}`);
  });

  return assessment;
}

// Export types for module use
export type { RiskAssessment, RiskScoreComponent };
