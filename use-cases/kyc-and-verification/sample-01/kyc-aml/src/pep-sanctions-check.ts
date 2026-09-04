import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { config } from "dotenv";
import type {
  CompanyIdentifier,
  BeneficialOwner,
  PEPCheckResult,
  SanctionsCheckResult,
  AuditTrailEntry,
  ScreeningCheck,
} from "./types.js";
import { log, createAuditEntry, finalizeAuditEntry, wait } from "./utils.js";

config();

// ============================================================
// PEP & Sanctions Checking Module
// ============================================================
// Demonstrates automated screening against PEP databases and
// sanctions lists including OFAC, EU, UN, and UK sanctions.
// ============================================================

interface PEPSanctionsOutput {
  pepResults: PEPCheckResult[];
  sanctionsResults: SanctionsCheckResult[];
  auditTrail: AuditTrailEntry[];
  sourcesChecked: string[];
  checks: ScreeningCheck[];
}

/**
 * Check OFAC Sanctions List (US Treasury)
 * Uses the publicly accessible OFAC SDN search
 */
async function checkOFACSanctions(
  stagehand: Stagehand,
  entityName: string,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ results: SanctionsCheckResult[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Sanctions Check - OFAC SDN",
    "US Treasury OFAC",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;

    log.info(`Checking OFAC SDN List for: "${entityName}"`);

    // Navigate to OFAC Sanctions Search
    await page.goto("https://sanctionssearch.ofac.treas.gov/");
    await page.waitForLoadState("networkidle");
    await wait(1500);

    // Use act() to perform the search step by step
    await stagehand.act(`Type "${entityName}" into the Name search field`);
    await wait(500);
    await stagehand.act(
      `Click the Search button to search for sanctions matches`,
    );
    await wait(2000);

    // Extract any matches found
    const searchResults = (
      await stagehand.extract(
        `Extract any sanctions matches found on this OFAC search results page.

      Set searchCompleted=true only if results or an explicit no-results message for the requested entity are visible. A loading page, error, challenge, or unsubmitted form is not completed.
      If the completed search explicitly shows "No results found", return an empty array.

      For any matches found, extract:
      - entityName: Name on the sanctions list
      - type: Type of entity (Individual, Entity, Vessel, Aircraft)
      - program: Sanctions program (e.g., SDGT, IRAN, CYBER)
      - listingDate: When they were added to the list
      - identifiers: Any ID numbers, passport numbers, or other identifiers shown

      Return up to 5 matches.`,
        z.object({
          searchCompleted: z.boolean(),
          hasMatches: z.boolean().describe("Whether any matches were found"),
          matches: z
            .array(
              z.object({
                entityName: z.string(),
                type: z.string().nullable(),
                program: z.string().nullable(),
                listingDate: z.string().nullable(),
                identifiers: z.array(z.string()),
              }),
            )
            .max(5),
        }),
      )
    ).data;

    if (searchResults.searchCompleted !== true || searchResults.hasMatches !== (searchResults.matches.length > 0)) {
      throw new Error("Search completion or match consistency could not be established");
    }

    const sanctionsResults: SanctionsCheckResult[] = searchResults.matches.map(
      (match) => ({
        entityName: match.entityName,
        matchedName: entityName,
        matchScore: 85, // OFAC search already does fuzzy matching
        sanctionsList: "OFAC SDN",
        sanctionsBody: "US Treasury",
        listingDate: match.listingDate,
        reason: null,
        program: match.program,
        identifiers: match.identifiers,
      }),
    );

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      searchResults.hasMatches
        ? `Found ${sanctionsResults.length} potential matches`
        : "No matches found",
      startTime,
    );

    if (searchResults.hasMatches) {
      log.warning(`OFAC: Found ${sanctionsResults.length} potential matches!`);
    } else {
      log.success("OFAC: No matches found");
    }

    return { results: sanctionsResults, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`OFAC check failed: ${errorMessage}`);
    return {
      results: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Check UK Sanctions List (HM Treasury)
 */
async function checkUKSanctions(
  stagehand: Stagehand,
  entityName: string,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ results: SanctionsCheckResult[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Sanctions Check - UK HM Treasury",
    "UK HM Treasury",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;

    log.info(`Checking UK Sanctions List for: "${entityName}"`);

    // Navigate to UK Sanctions search
    await page.goto("https://sanctionssearchapp.ofsi.hmtreasury.gov.uk/");
    await page.waitForLoadState("networkidle");
    await wait(1500);

    // Use act() to search step by step
    await stagehand.act(`Type "${entityName}" into the search field`);
    await wait(500);
    await stagehand.act(`Click the Search button`);
    await wait(2000);

    // Extract results
    const searchResults = (
      await stagehand.extract(
        `Extract any sanctions matches from this UK sanctions search results page.

      Set searchCompleted=true only if results or an explicit no-results message for the requested entity are visible. Loading, error, challenge and unsubmitted forms are not completed. Return an empty array only for a completed no-results search.

      For any matches, extract:
      - entityName: Name on the list
      - regime: Sanctions regime (e.g., Russia, Iran, Counter-Terrorism)
      - listingDate: Date added to list
      - groupType: Individual or Entity

      Return up to 5 matches.`,
        z.object({
          searchCompleted: z.boolean(),
          hasMatches: z.boolean(),
          matches: z
            .array(
              z.object({
                entityName: z.string(),
                regime: z.string().nullable(),
                listingDate: z.string().nullable(),
                groupType: z.string().nullable(),
              }),
            )
            .max(5),
        }),
      )
    ).data;

    if (searchResults.searchCompleted !== true || searchResults.hasMatches !== (searchResults.matches.length > 0)) {
      throw new Error("Search completion or match consistency could not be established");
    }

    const sanctionsResults: SanctionsCheckResult[] = searchResults.matches.map(
      (match) => ({
        entityName: match.entityName,
        matchedName: entityName,
        matchScore: 80,
        sanctionsList: "UK Sanctions List",
        sanctionsBody: "HM Treasury OFSI",
        listingDate: match.listingDate,
        reason: null,
        program: match.regime,
        identifiers: [],
      }),
    );

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      searchResults.hasMatches
        ? `Found ${sanctionsResults.length} potential matches`
        : "No matches found",
      startTime,
    );

    if (searchResults.hasMatches) {
      log.warning(
        `UK Sanctions: Found ${sanctionsResults.length} potential matches!`,
      );
    } else {
      log.success("UK Sanctions: No matches found");
    }

    return { results: sanctionsResults, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`UK Sanctions check failed: ${errorMessage}`);
    return {
      results: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Check for PEP status using publicly available sources
 * In production, this would integrate with commercial PEP databases
 */
async function checkPEPStatus(
  stagehand: Stagehand,
  personName: string,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ results: PEPCheckResult[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "PEP Check - Wikipedia/Public Sources",
    "Public Sources",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;

    log.info(`Checking PEP status for: "${personName}"`);

    // Search Wikipedia for political positions
    await page.goto(
      `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(personName)}&title=Special%3ASearch&ns0=1`,
    );
    await page.waitForLoadState("networkidle");
    await wait(1500);

    // Try to navigate to the person's page if found
    try {
      await stagehand.act(
        `Click on the search result that best matches "${personName}" if it appears to be about a person`,
      );
      await page.waitForLoadState("networkidle");
      await wait(1500);
    } catch {
      // No matching result found
    }

    // Extract PEP indicators from the page
    const pepInfo = (
      await stagehand.extract(
        `Analyze this Wikipedia page to determine if "${personName}" is a Politically Exposed Person (PEP).

      Look for:
      - Current or former government positions (minister, MP, senator, etc.)
      - Senior roles in state-owned enterprises
      - Judicial positions (judge, prosecutor)
      - Military leadership positions
      - Central bank or regulatory roles
      - Senior political party positions
      - International organization roles (UN, IMF, World Bank)

      Extract:
      - isPEP: true if any political/government positions found
      - positions: list of relevant positions held
      - country: country of political exposure
      - isCurrentlyActive: whether currently holding position

      Set subjectVerified=true only if this page identifies the searched person. Otherwise subjectVerified=false and no negative PEP conclusion can be made. Set isPEP=false only when the identified page has no political positions; this is a limited public-source observation, not comprehensive PEP clearance.`,
        z.object({
          subjectVerified: z.boolean(),
          isPEP: z.boolean(),
          positions: z.array(
            z.object({
              title: z.string(),
              organization: z.string().nullable(),
              startDate: z.string().nullable(),
              endDate: z.string().nullable(),
            }),
          ),
          country: z.string().nullable(),
          isCurrentlyActive: z.boolean(),
        }),
      )
    ).data;

    if (pepInfo.subjectVerified !== true) throw new Error("PEP subject identity could not be established");

    const pepResults: PEPCheckResult[] = pepInfo.positions.map((pos) => ({
      name: personName,
      isPEP: pepInfo.isPEP,
      pepType: pepInfo.isPEP
        ? pepInfo.country?.toLowerCase().includes("united kingdom")
          ? "domestic"
          : "foreign"
        : "not_pep",
      position: pos.title,
      country: pepInfo.country,
      level: "national", // Simplified for demo
      dateStarted: pos.startDate,
      dateEnded: pos.endDate,
      source: "Wikipedia",
      confidence: pepInfo.isPEP ? 70 : 30, // Lower confidence from public sources
    }));

    // If no positions found but isPEP is true, create a single result
    if (pepInfo.isPEP && pepResults.length === 0) {
      pepResults.push({
        name: personName,
        isPEP: true,
        pepType: "domestic",
        position: "Political position detected",
        country: pepInfo.country,
        level: "national",
        dateStarted: null,
        dateEnded: null,
        source: "Wikipedia",
        confidence: 60,
      });
    }

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      pepInfo.isPEP
        ? `Identified as PEP with ${pepResults.length} positions`
        : "No PEP indicators found",
      startTime,
    );

    if (pepInfo.isPEP) {
      log.warning(`PEP Status: ${personName} identified as PEP`);
    } else {
      log.success(`PEP Status: No PEP indicators found for ${personName}`);
    }

    return { results: pepResults, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`PEP check failed: ${errorMessage}`);
    return {
      results: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Main PEP and Sanctions screening function
 */
export async function screenPEPSanctions(
  company: CompanyIdentifier,
  beneficialOwners: BeneficialOwner[] = [],
): Promise<PEPSanctionsOutput> {
  log.section("PEP & SANCTIONS SCREENING");
  log.data("Company", company.name);
  log.data("Jurisdiction", company.jurisdiction);
  log.data("Beneficial Owners to Screen", beneficialOwners.length.toString());

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        ...{
          browserSettings: {
            blockAds: true,
          },
        },
      }),
    }),
  );

  const allPEPResults: PEPCheckResult[] = [];
  const allSanctionsResults: SanctionsCheckResult[] = [];
  const auditTrail: AuditTrailEntry[] = [];
  const sourcesChecked: string[] = [];
  const checks: ScreeningCheck[] = [
    { entity: company.name, source: "OFAC", kind: "sanctions", status: "not_run" },
    { entity: company.name, source: "UK", kind: "sanctions", status: "not_run" },
    ...beneficialOwners.flatMap(owner => [
      { entity: owner.name, source: "Public PEP" as const, kind: "pep" as const, status: "not_run" as const },
      { entity: owner.name, source: "OFAC" as const, kind: "sanctions" as const, status: "not_run" as const },
    ]),
  ];
  const recordCheck = (index: number, audit: AuditTrailEntry) => {
    checks[index].status = audit.success ? "completed" : "failed";
    checks[index].auditId = audit.id;
    if (audit.success && !sourcesChecked.includes(audit.source)) sourcesChecked.push(audit.source);
  };

  try {
    const sessionId = stagehand.browser.sessionId!;

    // Build the session recording URL directly
    const sessionRecordingUrl = `https://www.browserbase.com/sessions/${sessionId}`;

    log.info(`Session ID: ${sessionId}`);
    log.info(`Live View: ${sessionRecordingUrl}`);

    // 1. Check company against sanctions lists
    log.subsection("Company Sanctions Screening");

    // OFAC Check
    const ofacResult = await checkOFACSanctions(
      stagehand,
      company.name,
      sessionId,
      sessionRecordingUrl,
    );
    allSanctionsResults.push(...ofacResult.results);
    auditTrail.push(ofacResult.audit);
    recordCheck(0, ofacResult.audit);

    await wait(2000);

    // UK Sanctions Check
    const ukSanctionsResult = await checkUKSanctions(
      stagehand,
      company.name,
      sessionId,
      sessionRecordingUrl,
    );
    allSanctionsResults.push(...ukSanctionsResult.results);
    auditTrail.push(ukSanctionsResult.audit);
    recordCheck(1, ukSanctionsResult.audit);

    // 2. Check beneficial owners for PEP status and sanctions
    if (beneficialOwners.length > 0) {
      log.subsection("Beneficial Owner Screening");

      for (const [ownerIndex, owner] of beneficialOwners.entries()) {
        log.info(`Screening: ${owner.name}`);

        // PEP Check
        await wait(1500);
        const pepResult = await checkPEPStatus(
          stagehand,
          owner.name,
          sessionId,
          sessionRecordingUrl,
        );
        allPEPResults.push(...pepResult.results);
        auditTrail.push(pepResult.audit);
        recordCheck(2 + ownerIndex * 2, pepResult.audit);

        // Sanctions check for individual
        await wait(1500);
        const ownerOfacResult = await checkOFACSanctions(
          stagehand,
          owner.name,
          sessionId,
          sessionRecordingUrl,
        );
        allSanctionsResults.push(...ownerOfacResult.results);
        auditTrail.push(ownerOfacResult.audit);
        recordCheck(3 + ownerIndex * 2, ownerOfacResult.audit);
      }


    }

    await stagehand.close();
    await stagehand.browser.close();

    // Display results summary
    log.section("PEP & SANCTIONS RESULTS SUMMARY");

    const sanctionsHits = allSanctionsResults.length;
    const pepHits = allPEPResults.filter((r) => r.isPEP).length;

    log.data("Sources Checked", sourcesChecked.length.toString());
    log.data("Sanctions Matches", sanctionsHits.toString());
    log.data("PEP Matches", pepHits.toString());

    if (sanctionsHits > 0) {
      log.subsection("SANCTIONS ALERTS");
      allSanctionsResults.forEach((result, i) => {
        console.log(`\n  ${i + 1}. ${result.entityName}`);
        console.log(
          `     List: ${result.sanctionsList} | Body: ${result.sanctionsBody}`,
        );
        console.log(`     Program: ${result.program || "N/A"}`);
        console.log(`     Match Score: ${result.matchScore}%`);
      });
    }

    if (pepHits > 0) {
      log.subsection("PEP ALERTS");
      allPEPResults
        .filter((r) => r.isPEP)
        .forEach((result, i) => {
          console.log(`\n  ${i + 1}. ${result.name}`);
          console.log(`     Position: ${result.position}`);
          console.log(`     Country: ${result.country || "N/A"}`);
          console.log(`     Confidence: ${result.confidence}%`);
        });
    }

    return {
      pepResults: allPEPResults,
      sanctionsResults: allSanctionsResults,
      auditTrail,
      sourcesChecked,
      checks,
    };
  } catch (error) {
    log.error(`PEP/Sanctions screening failed: ${error}`);
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {
      /* ignore */
    }

    return {
      pepResults: allPEPResults,
      sanctionsResults: allSanctionsResults,
      auditTrail,
      sourcesChecked,
      checks,
    };
  }
}

// Run standalone if executed directly
const isMainModule = process.argv[1]?.includes("pep-sanctions-check");
if (isMainModule) {
  const testCompany: CompanyIdentifier = {
    name: process.env.DEMO_COMPANY_NAME || "SAMPLE_ORG Holdings",
    jurisdiction: process.env.DEMO_JURISDICTION || "United Kingdom",
  };

  // Example beneficial owners for demo
  const testOwners: BeneficialOwner[] = [
    {
      name: "John Smith",
      nationality: "British",
      dateOfBirth: null,
      ownershipPercentage: "25%",
      natureOfControl: "Shares",
      appointmentDate: "2020-01-15",
      isPEP: null,
      pepDetails: null,
    },
  ];

  screenPEPSanctions(testCompany, testOwners)
    .then((result) => {
      console.log("\n\n" + "=".repeat(60));
      console.log("FULL JSON OUTPUT");
      console.log("=".repeat(60));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
