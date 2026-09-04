import { z } from "zod";

// ============================================================
// SAMPLE_ORG KYC/AML Demo - Type Definitions
// ============================================================

// Company Identification
export interface CompanyIdentifier {
  name: string;
  jurisdiction: string;
  registrationNumber?: string;
  alternateNames?: string[];
}

// Adverse Media Result
export const AdverseMediaResultSchema = z.object({
  source: z.string().describe("News source name"),
  headline: z.string().describe("Article headline"),
  date: z.string().nullable().describe("Publication date"),
  url: z.string().nullable().describe("Article URL"),
  snippet: z.string().describe("Relevant excerpt"),
  sentiment: z
    .enum(["negative", "neutral", "positive"])
    .describe("Sentiment classification"),
  riskCategory: z
    .enum([
      "fraud",
      "corruption",
      "sanctions",
      "money_laundering",
      "regulatory_action",
      "litigation",
      "environmental",
      "other",
    ])
    .describe("Risk category"),
  relevanceScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Relevance to the entity (0-100)"),
});

export type AdverseMediaResult = z.infer<typeof AdverseMediaResultSchema>;

// Company Registry Data
export const CompanyRegistryDataSchema = z.object({
  jurisdiction: z.string().nullable().optional(),
  registrationNumber: z
    .string()
    .describe("Official registration/company number"),
  registeredName: z.string().describe("Official registered name"),
  status: z
    .enum(["active", "dissolved", "liquidation", "unknown"])
    .describe("Company status"),
  incorporationDate: z.string().nullable().describe("Date of incorporation"),
  registeredAddress: z
    .string()
    .nullable()
    .describe("Registered office address"),
  companyType: z
    .string()
    .nullable()
    .describe("Type of company (Ltd, PLC, etc)"),
  sicCodes: z
    .array(z.string())
    .describe("Standard Industrial Classification codes"),
  lastFilingDate: z.string().nullable().describe("Date of most recent filing"),
  sourceRegistry: z.string().describe("Which registry this data came from"),
});

export type CompanyRegistryData = z.infer<typeof CompanyRegistryDataSchema>;

export interface OwnershipCoverage {
  status: "completed" | "incomplete";
  pagesRead: number;
  hasMore: boolean | null;
  reason: string;
}

// Beneficial Owner
export const BeneficialOwnerSchema = z.object({
  name: z.string().describe("Name of the beneficial owner"),
  nationality: z
    .string()
    .nullable()
    .describe("Nationality/country of citizenship"),
  dateOfBirth: z.string().nullable().describe("Date of birth (month/year)"),
  ownershipPercentage: z
    .string()
    .nullable()
    .describe("Percentage of ownership"),
  natureOfControl: z
    .string()
    .nullable()
    .describe("Nature of control/ownership"),
  appointmentDate: z.string().nullable().describe("Date appointed/registered"),
  isPEP: z
    .boolean()
    .nullable()
    .describe("Is this person a Politically Exposed Person?"),
  pepDetails: z.string().nullable().describe("PEP role details if applicable"),
});

export type BeneficialOwner = z.infer<typeof BeneficialOwnerSchema>;

// PEP Check Result
export const PEPCheckResultSchema = z.object({
  name: z.string().describe("Name searched"),
  isPEP: z.boolean().describe("Whether the person is a PEP"),
  pepType: z
    .enum([
      "domestic",
      "foreign",
      "international_org",
      "family_member",
      "close_associate",
      "not_pep",
    ])
    .nullable(),
  position: z.string().nullable().describe("Political position held"),
  country: z.string().nullable().describe("Country of political exposure"),
  level: z.enum(["national", "regional", "local"]).nullable(),
  dateStarted: z.string().nullable(),
  dateEnded: z.string().nullable(),
  source: z.string().describe("Data source"),
  confidence: z.number().min(0).max(100).describe("Match confidence score"),
});

export type PEPCheckResult = z.infer<typeof PEPCheckResultSchema>;

// Sanctions Check Result
export const SanctionsCheckResultSchema = z.object({
  entityName: z.string().describe("Entity name on sanctions list"),
  matchedName: z.string().describe("Name that was searched"),
  matchScore: z.number().min(0).max(100).describe("Match similarity score"),
  sanctionsList: z.string().describe("Name of sanctions list"),
  sanctionsBody: z.string().describe("Issuing authority (OFAC, EU, UN, etc)"),
  listingDate: z.string().nullable(),
  reason: z.string().nullable().describe("Reason for listing"),
  program: z.string().nullable().describe("Sanctions program"),
  identifiers: z.array(z.string()).describe("Associated identifiers"),
});

export type SanctionsCheckResult = z.infer<typeof SanctionsCheckResultSchema>;

export interface ScreeningCheck {
  entity: string;
  source: "OFAC" | "UK" | "Public PEP";
  kind: "sanctions" | "pep";
  status: "not_run" | "failed" | "completed";
  auditId?: string;
}

// Risk Score Components
export interface RiskScoreComponent {
  category: string;
  score: number | null; // null when required evidence is incomplete
  observedScore?: number; // partial observations, never an overall clearance score
  status?: "completed" | "incomplete" | "not_applicable";
  weight: number; // 0-1, importance weight
  findings: string[];
  sources: string[];
}

// Aggregated Risk Assessment
export interface RiskAssessment {
  companyId: CompanyIdentifier;
  overallRiskScore: number | null; // null when screening is incomplete
  screeningChecks: ScreeningCheck[];
  riskLevel: "low" | "medium" | "high" | "critical" | "incomplete";
  components: {
    adverseMedia: RiskScoreComponent;
    pepExposure: RiskScoreComponent;
    sanctionsExposure: RiskScoreComponent;
    jurisdictionRisk: RiskScoreComponent;
    ownershipComplexity: RiskScoreComponent;
    regulatoryStatus: RiskScoreComponent;
  };
  recommendations: string[];
  requiredActions: string[];
  timestamp: string;
  auditTrailId: string;
}

// Audit Trail Entry
export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  source: string;
  sessionId: string;
  sessionRecordingUrl?: string;
  dataCollected: string;
  duration: number; // milliseconds
  success: boolean;
  errorMessage?: string;
}

// Full KYC Report
export interface KYCReport {
  id: string;
  generatedAt: string;
  company: CompanyIdentifier;
  registryData: CompanyRegistryData | null;
  registryCandidates?: CompanyRegistryData[];
  beneficialOwners: BeneficialOwner[];
  ownershipCoverage?: OwnershipCoverage;
  adverseMedia: AdverseMediaResult[];
  pepChecks: PEPCheckResult[];
  sanctionsChecks: SanctionsCheckResult[];
  riskAssessment: RiskAssessment;
  auditTrail: AuditTrailEntry[];
  dataSources: string[];
  dataCompleteness: number; // percentage of data points collected
  analysisNotes: string[];
}

// Demo Configuration
export interface DemoConfig {
  company: CompanyIdentifier;
  enableSessionRecording: boolean;
  maxConcurrentSearches: number;
  logLevel: "debug" | "info" | "warn" | "error";
  outputFormat: "json" | "console" | "both";
}
