import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { config } from "dotenv";
import type {
  CompanyIdentifier,
  CompanyRegistryData,
  AuditTrailEntry,
} from "./types.js";
import { CompanyRegistryDataSchema } from "./types.js";
import {
  log,
  createAuditEntry,
  finalizeAuditEntry,
  sanitizeCompanyName,
  wait,
} from "./utils.js";

config();

// ============================================================
// Company Registry Research Module
// ============================================================
// Demonstrates automated extraction of company information from
// official government registries like UK Companies House,
// SEC EDGAR, and other jurisdictional registries.
// ============================================================

interface CompanyRegistryOutput {
  data: CompanyRegistryData | null;
  auditTrail: AuditTrailEntry[];
  sourceRegistry: string;
  candidates: CompanyRegistryData[];
}

function normalizedIdentity(value: string | null | undefined) {
  return (value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function jurisdictionCode(value: string | null | undefined) {
  const normalized = normalizedIdentity(value);
  if (["uk", "gb", "united kingdom", "england and wales"].includes(normalized)) return "gb";
  return normalized;
}

function registryIdentityAgrees(company: CompanyIdentifier, candidate: CompanyRegistryData, finalUrl: string) {
  const expectedNumber = normalizedIdentity(company.registrationNumber);
  const number = normalizedIdentity(candidate.registrationNumber);
  const jurisdiction = jurisdictionCode(company.jurisdiction);
  if (!expectedNumber || !number || expectedNumber !== number || !jurisdiction ||
      jurisdictionCode(candidate.jurisdiction) !== jurisdiction) return false;
  const names = [company.name, ...(company.alternateNames ?? [])].map(normalizedIdentity).filter(Boolean);
  if (!names.includes(normalizedIdentity(candidate.registeredName))) return false;
  try {
    const url = new URL(finalUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (candidate.sourceRegistry === "UK Companies House") {
      const match = url.pathname.match(/^\/company\/([^/]+)\/?$/);
      return jurisdiction === "gb" && url.hostname === "find-and-update.company-information.service.gov.uk" &&
        !!match && normalizedIdentity(decodeURIComponent(match[1])) === number;
    }
    const match = url.pathname.match(/^\/companies\/([^/]+)\/([^/]+)\/?$/);
    return url.hostname === "opencorporates.com" && !!match &&
      jurisdictionCode(decodeURIComponent(match[1])) === jurisdiction && normalizedIdentity(decodeURIComponent(match[2])) === number;
  } catch { return false; }
}

/**
 * Search UK Companies House for company information
 * Companies House is the official UK company registry
 */
async function searchCompaniesHouse(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ data: CompanyRegistryData | null; candidate?: CompanyRegistryData; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Company Registry Search - UK Companies House",
    "UK Companies House",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = sanitizeCompanyName(company.name);

    log.info(`Searching UK Companies House for: "${searchQuery}"`);

    // Navigate to Companies House search
    await page.goto(
      "https://find-and-update.company-information.service.gov.uk/",
    );
    await page.waitForLoadState("networkidle");
    await wait(1000);

    // Use act to perform the search step by step
    await stagehand.act(
      `Type "${searchQuery}" into the company name search field`,
    );
    await wait(500);
    await stagehand.act(`Click the Search button to search for companies`);

    // Wait for search results
    await wait(2000);

    // Check if we need to select from results
    try {
      await stagehand.act(
        `Click on the first search result that best matches "${company.name}"`,
      );
      await page.waitForLoadState("networkidle");
      await wait(1500);
    } catch {
      log.warning(
        "Could not click on search result - may already be on company page",
      );
    }

    // Extract company information from the company page
    const companyData = (
      await stagehand.extract(
        `Extract the company information from this Companies House company profile page.

      Look for and extract:
      - registrationNumber: The company number (usually an 8-digit number like "00014259")
      - registeredName: The official registered company name
      - status: Company status (Active, Dissolved, Liquidation, etc.)
      - incorporationDate: Date of incorporation
      - registeredAddress: The registered office address
      - companyType: Type of company (Private Limited, PLC, LLP, etc.)
      - sicCodes: Any SIC codes listed (business classification codes)
      - lastFilingDate: Date of the last document filed

      If any information is not visible on the page, return null for that field.`,
        z.object({
          registrationNumber: z.string().describe("Company number"),
          registeredName: z.string().describe("Official company name"),
          status: z.string().describe("Company status"),
          incorporationDate: z.string().nullable(),
          registeredAddress: z.string().nullable(),
          companyType: z.string().nullable(),
          sicCodes: z.array(z.string()),
          lastFilingDate: z.string().nullable(),
        }),
      )
    ).data;

    // Map status to our enum
    const statusMap: Record<string, CompanyRegistryData["status"]> = {
      active: "active",
      dissolved: "dissolved",
      liquidation: "liquidation",
      "in liquidation": "liquidation",
      administration: "liquidation",
    };
    const mappedStatus =
      statusMap[companyData.status.toLowerCase()] || "unknown";

    const registryData: CompanyRegistryData = {
      registrationNumber: companyData.registrationNumber,
      registeredName: companyData.registeredName,
      status: mappedStatus,
      incorporationDate: companyData.incorporationDate,
      registeredAddress: companyData.registeredAddress,
      companyType: companyData.companyType,
      sicCodes: companyData.sicCodes,
      lastFilingDate: companyData.lastFilingDate,
      sourceRegistry: "UK Companies House",
      jurisdiction: "gb",
    };

    if (!registryIdentityAgrees(company, registryData, await page.url())) {
      return {
        data: null,
        candidate: registryData,
        audit: finalizeAuditEntry(audit, false, `Candidate extracted: ${registryData.registeredName} (${registryData.registrationNumber}); identity remains inconclusive.`, startTime,
          "Expected name, registration number, jurisdiction and registry detail URL must agree."),
      };
    }

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Extracted data for ${registryData.registeredName} (${registryData.registrationNumber})`,
      startTime,
    );

    log.success(`Found company: ${registryData.registeredName}`);
    log.data("Registration Number", registryData.registrationNumber);
    log.data("Status", registryData.status);
    log.data("Company Type", registryData.companyType);

    return { data: registryData, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`Companies House search failed: ${errorMessage}`);
    return {
      data: null,
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Search OpenCorporates for company information
 * OpenCorporates aggregates data from registries worldwide
 */
async function searchOpenCorporates(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ data: CompanyRegistryData | null; candidate?: CompanyRegistryData; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Company Registry Search - OpenCorporates",
    "OpenCorporates",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = sanitizeCompanyName(company.name);

    log.info(`Searching OpenCorporates for: "${searchQuery}"`);

    // Navigate to OpenCorporates search
    await page.goto(
      `https://opencorporates.com/companies?q=${encodeURIComponent(searchQuery)}&jurisdiction_code=${encodeURIComponent(jurisdictionCode(company.jurisdiction))}&utf8=%E2%9C%93`,
    );
    await page.waitForLoadState("networkidle");
    await wait(2000);

    // Try to click on the first matching result
    try {
      await stagehand.act(
        `Click on the first company result that matches "${company.name}"`,
      );
      await page.waitForLoadState("networkidle");
      await wait(1500);
    } catch {
      log.warning("Could not navigate to company detail page");
    }

    // Extract company information
    const companyData = (
      await stagehand.extract(
        `Extract company information from this OpenCorporates company page.

      Look for:
      - registrationNumber: Company/registry number
      - registeredName: Official company name
      - status: Current status (Active, Inactive, Dissolved)
      - incorporationDate: Date incorporated/registered
      - registeredAddress: Registered address
      - companyType: Type of entity
      - jurisdiction: Registry jurisdiction code (for example gb or us_de), not the office location

      Return null for any fields not found.`,
        z.object({
          registrationNumber: z.string(),
          registeredName: z.string(),
          status: z.string().nullable(),
          incorporationDate: z.string().nullable(),
          registeredAddress: z.string().nullable(),
          companyType: z.string().nullable(),
          jurisdiction: z.string().nullable(),
        }),
      )
    ).data;

    const statusMap: Record<string, CompanyRegistryData["status"]> = {
      active: "active",
      inactive: "dissolved",
      dissolved: "dissolved",
    };
    const mappedStatus =
      statusMap[(companyData.status || "").toLowerCase()] || "unknown";

    const registryData: CompanyRegistryData = {
      registrationNumber: companyData.registrationNumber,
      registeredName: companyData.registeredName,
      status: mappedStatus,
      incorporationDate: companyData.incorporationDate,
      registeredAddress: companyData.registeredAddress,
      companyType: companyData.companyType,
      sicCodes: [],
      lastFilingDate: null,
      sourceRegistry: "OpenCorporates",
      jurisdiction: companyData.jurisdiction,
    };

    if (!registryIdentityAgrees(company, registryData, await page.url())) {
      return {
        data: null,
        candidate: registryData,
        audit: finalizeAuditEntry(audit, false, `Candidate extracted: ${registryData.registeredName} (${registryData.registrationNumber}); identity remains inconclusive.`, startTime,
          "Expected name, registration number, jurisdiction and registry detail URL must agree."),
      };
    }

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Extracted data for ${registryData.registeredName}`,
      startTime,
    );

    log.success(`Found company: ${registryData.registeredName}`);
    return { data: registryData, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`OpenCorporates search failed: ${errorMessage}`);
    return {
      data: null,
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Main company registry research function
 * Attempts multiple registries based on jurisdiction
 */
export async function researchCompanyRegistry(
  company: CompanyIdentifier,
): Promise<CompanyRegistryOutput> {
  log.section("COMPANY REGISTRY RESEARCH");
  log.data("Company", company.name);
  log.data("Jurisdiction", company.jurisdiction);

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          browserSettings: {
            blockAds: true,
          },
        },
      }),
    }),
  );

  const auditTrail: AuditTrailEntry[] = [];
  let result: CompanyRegistryData | null = null;
  const candidates: CompanyRegistryData[] = [];
  let sourceRegistry = "";

  try {
    const sessionId = stagehand.browser.sessionId!;

    // Build the session recording URL directly
    const sessionRecordingUrl = `https://www.browserbase.com/sessions/${sessionId}`;

    log.info(`Session ID: ${sessionId}`);
    log.info(`Live View: ${sessionRecordingUrl}`);

    // Determine which registries to search based on jurisdiction
    const jurisdiction = company.jurisdiction.toLowerCase();

    if (
      jurisdiction.includes("uk") ||
      jurisdiction.includes("united kingdom") ||
      jurisdiction.includes("england")
    ) {
      // Search UK Companies House first
      log.subsection("UK Companies House Search");
      const ukResult = await searchCompaniesHouse(
        stagehand,
        company,
        sessionId,
        sessionRecordingUrl,
      );
      auditTrail.push(ukResult.audit);
      if (ukResult.candidate) candidates.push(ukResult.candidate);

      if (ukResult.data) {
        result = ukResult.data;
        sourceRegistry = "UK Companies House";
      }
    }

    // If no result yet, try OpenCorporates as fallback
    if (!result) {
      log.subsection("OpenCorporates Search (Fallback)");
      const ocResult = await searchOpenCorporates(
        stagehand,
        company,
        sessionId,
        sessionRecordingUrl,
      );
      auditTrail.push(ocResult.audit);
      if (ocResult.candidate) candidates.push(ocResult.candidate);

      if (ocResult.data) {
        result = ocResult.data;
        sourceRegistry = "OpenCorporates";
      }
    }

    await stagehand.close();
    await stagehand.browser.close();

    // Display results summary
    log.section("COMPANY REGISTRY RESULTS");
    if (result) {
      log.data("Source Registry", sourceRegistry);
      log.data("Registered Name", result.registeredName);
      log.data("Registration Number", result.registrationNumber);
      log.data("Status", result.status);
      log.data("Company Type", result.companyType);
      log.data("Incorporation Date", result.incorporationDate);
      log.data("Registered Address", result.registeredAddress);
    } else {
      log.warning("No company registry data found");
    }

    return {
      data: result,
      candidates,
      auditTrail,
      sourceRegistry,
    };
  } catch (error) {
    log.error(`Company registry research failed: ${error}`);
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {
      /* ignore */
    }

    return {
      data: null,
      candidates,
      auditTrail,
      sourceRegistry: "",
    };
  }
}

// Run standalone if executed directly
const isMainModule = process.argv[1]?.includes("company-registry-research");
if (isMainModule) {
  const testCompany: CompanyIdentifier = {
    name: process.env.DEMO_COMPANY_NAME || "COOKBOOK_EXAMPLE Holdings PLC",
    jurisdiction: process.env.DEMO_JURISDICTION || "United Kingdom",
  };

  researchCompanyRegistry(testCompany)
    .then((result) => {
      console.log("\n\n" + "=".repeat(60));
      console.log("FULL JSON OUTPUT");
      console.log("=".repeat(60));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
