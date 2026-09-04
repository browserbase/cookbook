import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import "dotenv/config";

// ============================================================
// LinkedIn Profile Validator for Sample Organization
// ============================================================
// Validates whether a person still works at the company your
// CRM says they do — by checking their live LinkedIn profile.
//
// Use case: Survivorship logic / tie-breaking between vendors.
// Instead of a human going to LinkedIn and eyeballing it,
// this script does it at scale.
// ============================================================

// --- Types ---

interface ValidateInput {
  name: string;
  expected_company: string;
  linkedin_url: string;
}

interface ValidationResult {
  name: string;
  expected_company: string;
  linkedin_url: string;
  actual_name: string | null;
  actual_headline: string | null;
  actual_company: string | null;
  actual_title: string | null;
  actual_location: string | null;
  person_name_match: boolean | null;
  profile_url_match: boolean | null;
  company_name_match: boolean | null;
  observed_profile_url: string | null;
  match: boolean | null;
  match_details: string;
  profile_accessible: boolean;
  error: string | null;
  session_url: string | null;
  duration_ms: number;
}

// Zod schema for structured extraction
const LinkedInProfileSchema = z.object({
  full_name: z
    .string()
    .nullable()
    .describe("The person's full name displayed at the top of their profile, or null if unavailable"),
  headline: z
    .string()
    .nullable()
    .describe(
      "The headline text below their name (e.g., 'Director of Engineering at Sample Organization')",
    ),
  current_company: z
    .string()
    .nullable()
    .describe(
      "The company name from their CURRENT (most recent) position in the Experience section. If not visible, extract from the headline.",
    ),
  current_title: z
    .string()
    .nullable()
    .describe(
      "Their current job title from the Experience section or headline",
    ),
  location: z
    .string()
    .nullable()
    .describe("Their location (e.g., 'San Francisco Bay Area')"),
});

// --- Core validation function ---

async function validateLinkedInProfile(
  input: ValidateInput,
  contextId?: string,
): Promise<ValidationResult> {
  const startTime = Date.now();
  let sessionId: string | null = null;
  if (!input.expected_company.trim()) {
    return result(input, null, startTime, {
      match_details: "INCONCLUSIVE: Expected company name is required.",
      error: "invalid_expected_company",
    });
  }

  const expectedProfile = canonicalProfileUrl(input.linkedin_url);
  if (!normalizePersonName(input.name) || !expectedProfile) {
    return result(input, null, startTime, {
      match_details: "INCONCLUSIVE: A person name and a valid LinkedIn /in/ profile URL are required.",
      error: "invalid_person_identity",
    });
  }

  // Build browser settings
  const browserSettings: Record<string, unknown> = {
    advancedStealth: true,
  };

  // Attach persistent context for logged-in sessions
  if (contextId) {
    browserSettings.context = { id: contextId, persist: true };
  }

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          browserSettings,
          proxies: [
            {
              type: "browserbase",
              geolocation: { country: process.env.PROXY_COUNTRY || "US" },
            },
          ],
        },
      }),
      cache: true,
    }),
  );

  try {
    sessionId = stagehand.browser.sessionId ?? null;
    const page = (await stagehand.browser.context.activePage())!;

    // Navigate to profile
    console.log(`  Navigating to: ${input.linkedin_url}`);
    await page.goto(input.linkedin_url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Check for auth wall
    const currentUrl = await page.url();
    const pageTitle = await page.title();
    const isAuthWall =
      currentUrl.includes("authwall") ||
      currentUrl.includes("/login") ||
      currentUrl.includes("/checkpoint") ||
      pageTitle.toLowerCase().includes("sign in") ||
      pageTitle.toLowerCase().includes("log in");

    if (isAuthWall) {
      await stagehand.close();
      await stagehand.browser.close();
      return result(input, sessionId, startTime, {
        match_details: contextId
          ? "Auth wall despite logged-in context — session may have expired."
          : "Auth wall — profile requires login. Set BROWSERBASE_CONTEXT_ID for logged-in access.",
        error: contextId ? "context_expired" : "auth_wall",
      });
    }

    // Check for 404
    if (
      pageTitle.toLowerCase().includes("page not found") ||
      currentUrl.includes("/404")
    ) {
      await stagehand.close();
      await stagehand.browser.close();
      return result(input, sessionId, startTime, {
        match_details: "Profile not found at this URL.",
        error: "profile_not_found",
      });
    }

    // Scroll to load lazy content (LinkedIn lazy-loads the Experience section)
    console.log(`  Scrolling to load full profile...`);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Extract profile data
    console.log(`  Extracting profile data...`);
    const profile = (
      await stagehand.extract(
        `Extract this person's current professional information from their LinkedIn profile page.
      Look at:
      1. Their name at the top of the profile
      2. Their headline (the text right below their name)
      3. Their most recent/current position in the Experience section
      4. Their location
      If the Experience section is not visible, extract what you can from the headline.
      For current_company, extract ONLY the company name (not the title).
      For current_title, extract ONLY the job title (not the company).
      If any field is not visible or cannot be determined, return null for that field.`,
        LinkedInProfileSchema,
      )
    ).data;

    const observedProfile = canonicalProfileUrl(await page.url());
    console.log(`  Found: ${profile.full_name} @ ${profile.current_company}`);
    await stagehand.close();
    await stagehand.browser.close();

    // Compare
    const companyNameMatch = compareCompany(
      profile.current_company,
      input.expected_company,
    );
    const actualName = normalizePersonName(profile.full_name);
    const personNameMatch = actualName ? actualName === normalizePersonName(input.name) : null;
    const profileUrlMatch = observedProfile ? observedProfile === expectedProfile : null;
    const match = personNameMatch === true && profileUrlMatch === true ? companyNameMatch : null;
    let matchDetails: string;
    if (personNameMatch !== true || profileUrlMatch !== true) {
      matchDetails = "INCONCLUSIVE: The displayed person name and final profile URL do not both agree with the requested identity. Company agreement alone cannot match this record.";
    } else if (match === true) {
      matchDetails = `NAME MATCH: Displayed person name and requested profile URL agree. Profile company "${profile.current_company}" matches the expected name; employment and legal-entity identity are not independently verified.`;
    } else if (match === false) {
      matchDetails = `NAME MISMATCH: Profile company differs from the expected name; employment is not independently verified.`;
    } else {
      matchDetails = `INCONCLUSIVE: Profile company "${profile.current_company ?? "unknown"}" could not be matched to "${input.expected_company}". Verify a canonical company identifier or an explicitly approved alias.`;
    }

    return result(input, sessionId, startTime, {
      person_name_match: personNameMatch,
      profile_url_match: profileUrlMatch,
      company_name_match: companyNameMatch,
      observed_profile_url: observedProfile,
      actual_name: profile.full_name,
      actual_headline: profile.headline,
      actual_company: profile.current_company,
      actual_title: profile.current_title,
      actual_location: profile.location,
      match,
      match_details: matchDetails,
      profile_accessible: true,
    });
  } catch (error) {
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {}
    const msg = error instanceof Error ? error.message : "Unknown error";
    return result(input, sessionId, startTime, {
      match_details: `Error: ${msg}`,
      error: msg,
    });
  }
}

// --- Helpers ---

function normalizePersonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  return /\p{L}/u.test(normalized) ? normalized : null;
}

function canonicalProfileUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(url.hostname) ||
        url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/in\/([^/]+)\/?$/);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).normalize("NFC");
    if (!slug || /[\s/\\?#]/.test(slug)) return null;
    return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
  } catch { return null; }
}

function result(
  input: ValidateInput,
  sessionId: string | null,
  startTime: number,
  data: Partial<ValidationResult>,
): ValidationResult {
  return {
    name: input.name,
    expected_company: input.expected_company,
    linkedin_url: input.linkedin_url,
    actual_name: null,
    actual_headline: null,
    actual_company: null,
    actual_title: null,
    actual_location: null,
    person_name_match: null,
    profile_url_match: null,
    company_name_match: null,
    observed_profile_url: null,
    match: null,
    match_details: "",
    profile_accessible: false,
    error: null,
    session_url: sessionId
      ? `https://www.browserbase.com/sessions/${sessionId}`
      : null,
    duration_ms: Date.now() - startTime,
    ...data,
  };
}

function compareCompany(
  actual: string | null,
  expected: string,
): boolean | null {
  if (!actual || !expected) return null;
  const normalize = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const a = normalize(actual);
  const b = normalize(expected);
  if (!a || !b || !/[\p{L}\p{N}]/u.test(a) || !/[\p{L}\p{N}]/u.test(b)) return null;
  return a === b ? true : null;
}

function selectContextId(args: string[], environmentValue?: string): string | undefined {
  let selected: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg !== "--context" && !arg.startsWith("--context=")) {
      throw new Error(`Unknown argument: ${arg}. Usage: linkedin-validator.ts [--context <id>]`);
    }
    if (selected !== undefined) throw new Error("Provide --context only once.");
    selected = arg === "--context" ? args[++index] : arg.slice("--context=".length);
    if (!selected || !/^[A-Za-z0-9_-]{1,200}$/.test(selected)) {
      throw new Error("--context requires a nonempty context identifier.");
    }
  }
  const value = selected ?? environmentValue?.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new Error("Invalid BROWSERBASE_CONTEXT_ID.");
  return value;
}

// --- Main ---

async function main() {
  const contextId = selectContextId(process.argv.slice(2), process.env.BROWSERBASE_CONTEXT_ID);
  // Profiles to validate — swap these out or read from a CSV
  const profiles: ValidateInput[] = [
    {
      name: "Parker Conrad",
      expected_company: "Sample Organization",
      linkedin_url: "https://www.linkedin.com/in/parkerconrad/",
    },
  ];


  console.log("\n" + "=".repeat(60));
  console.log("LINKEDIN PROFILE VALIDATOR");
  console.log(contextId ? `Persistent context selected: ${contextId}` : "No persistent context selected.");
  console.log("=".repeat(60));

  const results: ValidationResult[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    console.log(
      `\n[${i + 1}/${profiles.length}] ${p.name} — expected: ${p.expected_company}`,
    );

    const r = await validateLinkedInProfile(p, contextId);
    results.push(r);

    const icon = r.match === true ? "✅" : r.match === false ? "❌" : "❓";
    console.log(
      `  ${icon} ${r.match_details} (${(r.duration_ms / 1000).toFixed(1)}s)`,
    );
    if (r.session_url) console.log(`  📺 ${r.session_url}`);

    if (i < profiles.length - 1) await new Promise((r) => setTimeout(r, 5000));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  const nameMatched = results.filter((r) => r.match === true).length;
  const mismatched = results.filter((r) => r.match === false).length;
  const inconclusive = results.filter((r) => r.match === null).length;
  console.log(
    `✅ ${nameMatched} name matched · ❌ ${mismatched} mismatched · ❓ ${inconclusive} inconclusive`,
  );
  console.log(
    `⏱️  ${(results.reduce((a, r) => a + r.duration_ms, 0) / 1000).toFixed(1)}s total`,
  );
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

export { validateLinkedInProfile, ValidateInput, ValidationResult };
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
