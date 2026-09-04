import chalk from "chalk";
import type {
  AuditTrailEntry,
  RiskAssessment,
  RiskScoreComponent,
} from "./types.js";

// ============================================================
// Utility Functions for SAMPLE_ORG KYC/AML Demo
// ============================================================

/**
 * Generate a unique ID for audit trail entries
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an audit trail entry
 */
export function createAuditEntry(
  action: string,
  source: string,
  sessionId: string,
  sessionRecordingUrl?: string,
): AuditTrailEntry {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    source,
    sessionId,
    sessionRecordingUrl,
    dataCollected: "",
    duration: 0,
    success: false,
  };
}

/**
 * Finalize an audit entry with results
 */
export function finalizeAuditEntry(
  entry: AuditTrailEntry,
  success: boolean,
  dataCollected: string,
  startTime: number,
  errorMessage?: string,
): AuditTrailEntry {
  return {
    ...entry,
    success,
    dataCollected,
    duration: Date.now() - startTime,
    errorMessage,
  };
}

/**
 * Calculate overall risk score from components
 */
export function calculateOverallRisk(
  components: Record<string, RiskScoreComponent>,
): {
  score: number | null;
  level: "low" | "medium" | "high" | "critical" | "incomplete";
} {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const component of Object.values(components)) {
    if (component.score === null) return { score: null, level: "incomplete" };
    weightedScore += component.score * component.weight;
    totalWeight += component.weight;
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  let level: "low" | "medium" | "high" | "critical";
  if (score <= 25) level = "low";
  else if (score <= 50) level = "medium";
  else if (score <= 75) level = "high";
  else level = "critical";

  return { score, level };
}

/**
 * Colorized logging functions
 */
export const log = {
  info: (message: string) => console.log(chalk.blue("ℹ"), message),
  success: (message: string) => console.log(chalk.green("✓"), message),
  warning: (message: string) => console.log(chalk.yellow("⚠"), message),
  error: (message: string) => console.log(chalk.red("✗"), message),
  section: (title: string) => {
    console.log("\n" + chalk.cyan("═".repeat(60)));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan("═".repeat(60)));
  },
  subsection: (title: string) => {
    console.log("\n" + chalk.gray("─".repeat(40)));
    console.log(chalk.white.bold(`  ${title}`));
    console.log(chalk.gray("─".repeat(40)));
  },
  data: (label: string, value: string | number | null) => {
    const displayValue = value ?? chalk.gray("N/A");
    console.log(`  ${chalk.gray(label + ":")} ${displayValue}`);
  },
  riskScore: (score: number | null, level: string) => {
    if (score === null) { console.log("  Risk Score: UNAVAILABLE (INCOMPLETE SCREENING)"); return; }
    const colorFn =
      level === "low"
        ? chalk.green
        : level === "medium"
          ? chalk.yellow
          : level === "high"
            ? chalk.red
            : chalk.bgRed.white;
    console.log(
      `  ${chalk.bold("Risk Score:")} ${colorFn(`${score}/100 (${level.toUpperCase()})`)}`,
    );
  },
};

/**
 * Format duration in human readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Generate risk recommendations based on assessment
 */
export function generateRecommendations(
  assessment: Partial<RiskAssessment>,
): string[] {
  const recommendations: string[] = [];
  const components = assessment.components;

  if (!components) return recommendations;
  if (Object.values(components).some(component => component.score === null)) {
    recommendations.push("Screening incomplete: do not treat this assessment as clearance; complete failed or missing checks and review observed matches");
  }

  if ((components.adverseMedia?.observedScore ?? components.adverseMedia?.score ?? 0) > 50) {
    recommendations.push(
      "Enhanced due diligence required due to adverse media findings",
    );
    recommendations.push(
      "Review all negative news articles and assess materiality",
    );
  }

  if ((components.pepExposure?.observedScore ?? components.pepExposure?.score ?? 0) > 30) {
    recommendations.push(
      "PEP exposure detected - require senior management approval",
    );
    recommendations.push(
      "Implement enhanced monitoring for PEP-related transactions",
    );
  }

  if ((components.sanctionsExposure?.observedScore ?? components.sanctionsExposure?.score ?? 0) > 0) {
    recommendations.push(
      "CRITICAL: Potential sanctions match detected - escalate immediately",
    );
    recommendations.push(
      "Do not proceed with onboarding until sanctions check cleared",
    );
  }

  if ((components.jurisdictionRisk?.observedScore ?? components.jurisdictionRisk?.score ?? 0) > 60) {
    recommendations.push(
      "High-risk jurisdiction - additional source of wealth verification required",
    );
  }

  if ((components.ownershipComplexity?.observedScore ?? components.ownershipComplexity?.score ?? 0) > 50) {
    recommendations.push(
      "Complex ownership structure - verify ultimate beneficial ownership",
    );
    recommendations.push(
      "Consider requesting certified ownership documentation",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Standard due diligence procedures apply");
    recommendations.push("Proceed with periodic review schedule");
  }

  return recommendations;
}

/**
 * Sanitize company name for search queries
 */
export function sanitizeCompanyName(name: string): string {
  return name.replace(/['"]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Wait helper for rate limiting
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await wait(delayMs * attempt);
      }
    }
  }

  throw lastError;
}
