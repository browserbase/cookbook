import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { config } from "dotenv";
import type {
  CompanyIdentifier,
  OwnershipCoverage,
  BeneficialOwner,
  AuditTrailEntry,
} from "./types.js";
import {
  log,
  createAuditEntry,
  finalizeAuditEntry,
  sanitizeCompanyName,
  wait,
} from "./utils.js";

config();

// ============================================================
// Beneficial Ownership Extraction Module
// ============================================================
// Demonstrates automated extraction of beneficial ownership
// information from company registries and PSC (Persons with
// Significant Control) registers.
// ============================================================

interface BeneficialOwnershipOutput {
  owners: BeneficialOwner[];
  coverage: OwnershipCoverage;
  ownershipStructure: string;
  complexityScore: number; // 0-100, higher = more complex
  auditTrail: AuditTrailEntry[];
  sourceRegistry: string;
}

/**
 * Extract PSC (Persons with Significant Control) from UK Companies House
 */
async function extractUKPSC(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  companyNumber: string | null,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ owners: BeneficialOwner[]; audit: AuditTrailEntry; coverage: OwnershipCoverage }> {
  const audit = createAuditEntry(
    "Beneficial Ownership - UK PSC Register",
    "UK Companies House PSC",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  const owners: BeneficialOwner[] = [];
  const coverage: OwnershipCoverage = { status: "incomplete", pagesRead: 0, hasMore: null, reason: "PSC retrieval did not finish" };
  const visited = new Set<string>();
  const records = new Set<string>();
  const pageContents = new Set<string>();
  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = sanitizeCompanyName(company.name);

    log.info(`Extracting PSC data for: "${searchQuery}"`);

    // If we have a company number, go directly to the PSC page
    if (companyNumber) {
      await page.goto(
        `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}/persons-with-significant-control`,
      );
    } else {
      // Search for the company first
      await page.goto(
        "https://find-and-update.company-information.service.gov.uk/",
      );
      await page.waitForLoadState("networkidle");
      await wait(1000);

      // Use act() to perform the search step by step
      await stagehand.act(
        `Type "${searchQuery}" into the company name search field`,
      );
      await wait(500);
      await stagehand.act(`Click the Search button`);
      await wait(2000);
      await stagehand.act(
        `Click on the first company result that matches "${searchQuery}"`,
      );
      await wait(1500);
      await stagehand.act(
        `Click on the "Persons with significant control" link`,
      );
    }

    await page.waitForLoadState("networkidle");
    await wait(2000);

    const initial = new URL(await page.url());
    if (initial.protocol !== "https:" || initial.hostname !== "find-and-update.company-information.service.gov.uk" ||
        !/^\/company\/[^/]+\/persons-with-significant-control\/?$/.test(initial.pathname) ||
        initial.username || initial.password || initial.port ||
        (companyNumber && initial.pathname.split("/")[2] !== companyNumber)) {
      throw new Error("PSC detail page identity could not be established");
    }
    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const current = new URL(await page.url());
      current.hash = "";
      current.searchParams.sort();
      if (current.origin !== initial.origin || current.pathname !== initial.pathname || visited.has(current.href)) {
        throw new Error("PSC pagination changed entity or repeated a page");
      }
      visited.add(current.href);
    // Extract PSC information
    const pscData = (
      await stagehand.extract(
        `Extract all Persons with Significant Control (PSC) from this Companies House PSC page.

      For each person or entity listed, extract:
      - name: Full name of the person or corporate entity
      - nationality: Nationality (for individuals)
      - dateOfBirth: Month and year of birth (if shown, e.g., "March 1975")
      - ownershipPercentage: The ownership/voting rights range (e.g., "25% to 50%", "More than 75%")
      - natureOfControl: How they control the company (e.g., "ownership of shares", "voting rights", "right to appoint directors")
      - appointmentDate: Date they were registered as PSC (notified on date)
      - address: Correspondence address (country only is fine)

      Also determine:
      - isIndividual: Whether this is a person (true) or a corporate entity (false)

      Extract ALL PSCs listed on the page.`,
        z.object({
          persons: z.array(
            z.object({
              name: z.string(),
              nationality: z.string().nullable(),
              dateOfBirth: z.string().nullable(),
              ownershipPercentage: z.string().nullable(),
              natureOfControl: z.string().nullable(),
              appointmentDate: z.string().nullable(),
              address: z.string().nullable(),
              isIndividual: z.boolean(),
            }),
          ),
          hasMorePSCs: z
            .boolean()
            .describe("Whether there appear to be more PSCs not shown"),
        }),
      )
    ).data;

    coverage.pagesRead++;
    coverage.hasMore = pscData.hasMorePSCs;
    const fingerprint = JSON.stringify(pscData.persons);
    if (pageContents.has(fingerprint)) throw new Error("PSC pagination repeated page contents");
    pageContents.add(fingerprint);
    for (const psc of pscData.persons) {
      const owner: BeneficialOwner = {
        name: psc.name, nationality: psc.nationality, dateOfBirth: psc.dateOfBirth,
        ownershipPercentage: psc.ownershipPercentage, natureOfControl: psc.natureOfControl,
        appointmentDate: psc.appointmentDate, isPEP: null, pepDetails: null,
      };
      const key = JSON.stringify(owner);
      if (!records.has(key)) { records.add(key); owners.push(owner); }
    }
    const nextLinks = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(a => a.getClientRects().length > 0 && getComputedStyle(a).visibility === "visible" &&
        (a.rel.split(/\s+/).includes("next") || /^next(?:\s+page)?$/i.test((a.textContent || "").trim())))
      .map(a => a.href));
    const nextUrls = [...new Set(nextLinks.map(href => {
      const url = new URL(href, current.href); url.hash = ""; url.searchParams.sort(); return url.href;
    }))];
    if (!pscData.hasMorePSCs && nextUrls.length === 0) {
      coverage.status = "completed"; coverage.hasMore = false;
      coverage.reason = "Reached the end of the observed PSC pagination";
      break;
    }
    coverage.hasMore = true;
    if (pageIndex === 4) throw new Error("PSC page limit reached with additional records remaining");
    if (nextUrls.length !== 1) throw new Error("PSC next page is missing or ambiguous");
    const next = new URL(nextUrls[0]);
    if (next.origin !== initial.origin || next.pathname !== initial.pathname || next.username || next.password || visited.has(next.href)) {
      throw new Error("PSC next page is outside the current entity or already visited");
    }
    await page.goto(next.href);
    await page.waitForLoadState("networkidle");
    }

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Extracted ${owners.length} PSC records`,
      startTime,
    );

    log.success(`Found ${owners.length} Persons with Significant Control`);
    owners.forEach((owner, i) => {
      log.data(
        `  ${i + 1}. ${owner.name}`,
        owner.ownershipPercentage || "Unknown %",
      );
    });

    return { owners, coverage, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`PSC extraction failed: ${errorMessage}`);
    return {
      owners,
      coverage: { ...coverage, status: "incomplete", reason: errorMessage },
      audit: finalizeAuditEntry(audit, false, `Retained ${owners.length} PSC records from ${coverage.pagesRead} pages; coverage incomplete`, startTime, errorMessage),
    };
  }
}

/**
 * Extract beneficial ownership from OpenCorporates
 * Useful for non-UK jurisdictions
 */
async function extractOpenCorporatesOwnership(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ owners: BeneficialOwner[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Beneficial Ownership - OpenCorporates",
    "OpenCorporates",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = sanitizeCompanyName(company.name);

    log.info(`Searching OpenCorporates for ownership data: "${searchQuery}"`);

    await page.goto(
      `https://opencorporates.com/companies?q=${encodeURIComponent(searchQuery)}`,
    );
    await page.waitForLoadState("networkidle");
    await wait(1500);

    // Navigate to company page
    try {
      await stagehand.act(
        `Click on the first company result matching "${company.name}"`,
      );
      await page.waitForLoadState("networkidle");
      await wait(1500);
    } catch {
      log.warning("Could not navigate to company page");
    }

    // Look for officers/directors which often indicates ownership
    const ownershipData = (
      await stagehand.extract(
        `Extract any officers, directors, or beneficial ownership information from this OpenCorporates page.

      Look for:
      - Officers/Directors section
      - Any beneficial ownership or controlling persons
      - Parent company information (indicates corporate ownership)

      For each person/entity found, extract:
      - name: Name of the person or entity
      - role: Their role (Director, Secretary, Shareholder, Parent Company)
      - appointmentDate: When they were appointed
      - nationality: Nationality or jurisdiction

      This information helps identify who controls the company.`,
        z.object({
          officers: z.array(
            z.object({
              name: z.string(),
              role: z.string().nullable(),
              appointmentDate: z.string().nullable(),
              nationality: z.string().nullable(),
            }),
          ),
          parentCompany: z
            .string()
            .nullable()
            .describe("Name of parent company if any"),
        }),
      )
    ).data;

    // Convert to beneficial owners format
    const owners: BeneficialOwner[] = ownershipData.officers.map((officer) => ({
      name: officer.name,
      nationality: officer.nationality,
      dateOfBirth: null,
      ownershipPercentage: null,
      natureOfControl: officer.role,
      appointmentDate: officer.appointmentDate,
      isPEP: null,
      pepDetails: null,
    }));

    // Add parent company if exists
    if (ownershipData.parentCompany) {
      owners.unshift({
        name: ownershipData.parentCompany,
        nationality: null,
        dateOfBirth: null,
        ownershipPercentage: "Parent Company",
        natureOfControl: "Corporate Ownership",
        appointmentDate: null,
        isPEP: null,
        pepDetails: null,
      });
    }

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Extracted ${owners.length} ownership records`,
      startTime,
    );

    log.success(`Found ${owners.length} ownership records from OpenCorporates`);
    return { owners, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`OpenCorporates extraction failed: ${errorMessage}`);
    return {
      owners: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Calculate ownership structure complexity score
 */
function calculateComplexityScore(owners: BeneficialOwner[]): number {
  let score = 0;

  // More owners = more complex
  score += Math.min(owners.length * 10, 30);

  // Corporate owners indicate layered structure
  const corporateOwners = owners.filter(
    (o) =>
      o.natureOfControl?.toLowerCase().includes("corporate") ||
      o.ownershipPercentage === "Parent Company" ||
      o.name.toLowerCase().includes("ltd") ||
      o.name.toLowerCase().includes("limited") ||
      o.name.toLowerCase().includes("inc") ||
      o.name.toLowerCase().includes("corp"),
  );
  score += corporateOwners.length * 15;

  // Non-UK/US nationalities add complexity
  const foreignOwners = owners.filter((o) => {
    const nat = o.nationality?.toLowerCase() || "";
    return (
      nat &&
      !nat.includes("british") &&
      !nat.includes("american") &&
      !nat.includes("united kingdom") &&
      !nat.includes("united states")
    );
  });
  score += foreignOwners.length * 10;

  // Missing information adds uncertainty
  const missingData = owners.filter(
    (o) => !o.ownershipPercentage || !o.natureOfControl,
  );
  score += missingData.length * 5;

  return Math.min(score, 100);
}

/**
 * Describe ownership structure
 */
function describeOwnershipStructure(owners: BeneficialOwner[]): string {
  if (owners.length === 0) {
    return "No beneficial ownership information available";
  }

  if (owners.length === 1) {
    const owner = owners[0];
    if (
      owner.ownershipPercentage?.includes("75") ||
      owner.ownershipPercentage?.includes("100")
    ) {
      return "Single controlling owner (majority stake)";
    }
    return "Single identified beneficial owner";
  }

  const corporateOwners = owners.filter(
    (o) =>
      o.name.toLowerCase().includes("ltd") ||
      o.name.toLowerCase().includes("limited") ||
      o.ownershipPercentage === "Parent Company",
  );

  if (corporateOwners.length > 0) {
    return `Complex corporate structure with ${corporateOwners.length} corporate owner(s) and ${owners.length - corporateOwners.length} individual(s)`;
  }

  return `${owners.length} beneficial owners identified`;
}

/**
 * Main beneficial ownership extraction function
 */
export async function extractBeneficialOwnership(
  company: CompanyIdentifier,
  companyNumber?: string,
): Promise<BeneficialOwnershipOutput> {
  log.section("BENEFICIAL OWNERSHIP EXTRACTION");
  log.data("Company", company.name);
  log.data("Jurisdiction", company.jurisdiction);
  if (companyNumber) {
    log.data("Company Number", companyNumber);
  }

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
  let owners: BeneficialOwner[] = [];
  let sourceRegistry = "";
  let coverage: OwnershipCoverage = { status: "incomplete", pagesRead: 0, hasMore: null, reason: "Ownership coverage not established" };

  try {
    const sessionId = stagehand.browser.sessionId!;

    // Build the session recording URL directly
    const sessionRecordingUrl = `https://www.browserbase.com/sessions/${sessionId}`;

    log.info(`Session ID: ${sessionId}`);
    log.info(`Live View: ${sessionRecordingUrl}`);

    // Determine which registry to use based on jurisdiction
    const jurisdiction = company.jurisdiction.toLowerCase();

    if (
      jurisdiction === "gb" ||
      jurisdiction.includes("uk") ||
      jurisdiction.includes("united kingdom") ||
      jurisdiction.includes("england")
    ) {
      // Use UK Companies House PSC Register
      log.subsection("UK PSC Register Extraction");
      const pscResult = await extractUKPSC(
        stagehand,
        company,
        companyNumber || null,
        sessionId,
        sessionRecordingUrl,
      );
      owners = pscResult.owners;
      coverage = pscResult.coverage;
      auditTrail.push(pscResult.audit);
      sourceRegistry = "UK Companies House PSC Register";
    }

    // If no results, try OpenCorporates as fallback
    if (owners.length === 0 && sourceRegistry !== "UK Companies House PSC Register") {
      log.subsection("OpenCorporates Fallback");
      const ocResult = await extractOpenCorporatesOwnership(
        stagehand,
        company,
        sessionId,
        sessionRecordingUrl,
      );
      owners = ocResult.owners;
      auditTrail.push(ocResult.audit);
      sourceRegistry = "OpenCorporates";
    }

    await stagehand.close();
    await stagehand.browser.close();

    // Calculate complexity and describe structure
    const complexityScore = calculateComplexityScore(owners);
    const ownershipStructure = (coverage.status === "incomplete" ? `Partial/unconfirmed coverage: ${coverage.reason}. ` : "") + describeOwnershipStructure(owners);

    // Display results summary
    log.section("BENEFICIAL OWNERSHIP RESULTS");
    log.data("Source Registry", sourceRegistry);
    log.data("Beneficial Owners Found", owners.length.toString());
    log.data("Structure", ownershipStructure);
    log.data("Complexity Score", `${complexityScore}/100`);

    if (owners.length > 0) {
      log.subsection("Beneficial Owners");
      owners.forEach((owner, i) => {
        console.log(`\n  ${i + 1}. ${owner.name}`);
        if (owner.nationality)
          console.log(`     Nationality: ${owner.nationality}`);
        if (owner.ownershipPercentage)
          console.log(`     Ownership: ${owner.ownershipPercentage}`);
        if (owner.natureOfControl)
          console.log(`     Control: ${owner.natureOfControl}`);
      });
    }

    return {
      owners,
      coverage,
      ownershipStructure,
      complexityScore,
      auditTrail,
      sourceRegistry,
    };
  } catch (error) {
    log.error(`Beneficial ownership extraction failed: ${error}`);
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {
      /* ignore */
    }

    return {
      owners,
      coverage: { ...coverage, status: "incomplete", reason: "Extraction failed" },
      ownershipStructure: "Extraction failed",
      complexityScore: 100, // High complexity due to unknown
      auditTrail,
      sourceRegistry: "",
    };
  }
}

// Run standalone if executed directly
const isMainModule = process.argv[1]?.includes("beneficial-ownership");
if (isMainModule) {
  const testCompany: CompanyIdentifier = {
    name: process.env.DEMO_COMPANY_NAME || "COOKBOOK_EXAMPLE Holdings PLC",
    jurisdiction: process.env.DEMO_JURISDICTION || "United Kingdom",
  };

  extractBeneficialOwnership(testCompany)
    .then((result) => {
      console.log("\n\n" + "=".repeat(60));
      console.log("FULL JSON OUTPUT");
      console.log("=".repeat(60));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
