import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import "dotenv/config";

// ============================================================
// Company Website Intelligence Scraper for Sample Organization
// ============================================================
// Agentically crawls a company's website to extract:
//   1. ATS detection (what hiring platform do they use?)
//   2. Blog/press mentions of a target person
//   3. Leadership team info
//   4. Technology signals from job postings & content
//
// This replaces Sample Organization's current Puppeteer-based scraping
// with an agentic approach that adapts to different site layouts.
// ============================================================

// --- Types ---

interface IntelInput {
  company_name: string;
  domain: string; // e.g. "browserbase.com"
  target_person?: string; // optional: look for mentions of this person
}

interface ATSResult {
  ats_detected: string | null; // e.g. "Greenhouse", "Lever", "Ashby"
  careers_url: string | null;
  open_roles_count: number | null;
  evidence: string; // how we determined the ATS
}

interface PersonMention {
  person_name: string;
  page_url: string | null;
  discovery_url: string;
  evidence_kind: "search_snippet" | "listing_excerpt";
  page_title: string;
  context: string; // surrounding text / snippet
  content_type: string; // "blog_post", "press_release", "about_page", etc.
  date: string | null;
}

interface LeadershipMember {
  name: string;
  title: string;
  department: string | null;
}

interface TechSignal {
  signal: string; // e.g. "Uses AWS", "Hiring for Kubernetes"
  source: string; // where we found it
  confidence: string; // "high", "medium", "low"
}

interface CompanyIntelResult {
  // Input echo
  company_name: string;
  domain: string;
  target_person: string | null;

  // Findings
  ats: ATSResult;
  person_mentions: PersonMention[];
  leadership: LeadershipMember[];
  tech_signals: TechSignal[];
  company_description: string | null;

  // Meta
  pages_visited: string[];
  session_replay_url: string | null;
  duration_ms: number;
  error: string | null;
}

// --- Zod schemas for extraction ---

const BlogMentionsSchema = z.object({
  mentions: z
    .array(
      z.object({
        title: z.string().describe("The blog post or article title"),
        article_url: z.string().nullable().describe("The actual result/article link href, or null when no link is available. Never invent a URL."),
        context: z
          .string()
          .describe(
            "A 1-2 sentence snippet showing how the person is mentioned",
          ),
        date: z.string().nullable().describe("Publication date if visible"),
        content_type: z
          .string()
          .describe(
            "Type of content: blog_post, press_release, case_study, news, about_page",
          ),
      }),
    )
    .max(10),
});

const LeadershipSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().describe("Full name"),
        title: z.string().describe("Job title"),
        department: z
          .string()
          .nullable()
          .describe("Department if apparent from title"),
      }),
    )
    .max(20),
  company_description: z
    .string()
    .nullable()
    .describe(
      "A 1-2 sentence description of what the company does, from the About page",
    ),
});

const TechSignalsSchema = z.object({
  signals: z
    .array(
      z.object({
        signal: z
          .string()
          .describe(
            "Technology or tool detected, e.g. 'Uses Kubernetes', 'AWS infrastructure', 'React frontend'",
          ),
        source: z
          .string()
          .describe(
            "Where this signal was found, e.g. 'job posting for SRE', 'blog post about migration'",
          ),
        confidence: z
          .enum(["high", "medium", "low"])
          .describe("Confidence level"),
      }),
    )
    .max(15),
});

// --- Phase functions ---

function atsVendorFromUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const vendors: Record<string, string> = {
    'greenhouse.io': 'Greenhouse', 'grnh.se': 'Greenhouse', 'lever.co': 'Lever',
    'ashbyhq.com': 'Ashby', 'myworkdayjobs.com': 'Workday', 'myworkday.com': 'Workday',
    'icims.com': 'iCIMS', 'jobvite.com': 'Jobvite', 'smartrecruiters.com': 'SmartRecruiters',
    'bamboohr.com': 'BambooHR', 'sample_org.com': 'Sample Organization',
    'welcometothejungle.com': 'Welcome to the Jungle', 'breezy.hr': 'Breezy HR',
  };
  for (const [host, vendor] of Object.entries(vendors)) {
    if (url.hostname === host || url.hostname.endsWith('.' + host)) return vendor;
  }
  return null;
}

function readCareersEvidence() {
  const visible = (el: Element) => {
    if (!el.getClientRects().length) return false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const careers = /\b(careers?|jobs?|open positions|open roles|join our team|work with us)\b/i;
  const isCareers = [...document.querySelectorAll('h1,h2,[role="heading"]')]
    .some(el => visible(el) && careers.test(el.textContent ?? ''));
  const urls = [
    ...[...document.querySelectorAll<HTMLIFrameElement>('iframe[src]')].filter(visible).map(el => el.src),
    ...[...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .filter(el => visible(el) && /\b(apply|jobs?|careers?|positions?|roles?|powered by)\b/i.test(el.textContent ?? ''))
      .map(el => el.href),
  ];
  return { isCareers, urls };
}

async function detectATS(
  stagehand: Stagehand,
  domain: string,
): Promise<{ ats: ATSResult; pagesVisited: string[] }> {
  const page = (await stagehand.browser.context.activePage())!;
  const pagesVisited: string[] = [];
  let careersUrl: string | null = null;
  let evidence: ReturnType<typeof readCareersEvidence> | null = null;
  const inspect = async () => {
    const observed = await page.evaluate(readCareersEvidence);
    if (!observed.isCareers) return false;
    const current = await page.url();
    const parsed = new URL(current);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    careersUrl = current;
    evidence = observed;
    pagesVisited.push(current);
    return true;
  };
  try {
    const home = `https://${domain}`;
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 15000 });
    pagesVisited.push(await page.url());
    const action = await stagehand.act('Click the Careers or Jobs link in the navigation or footer.', { page });
    if (action.data.success) await inspect();
  } catch { /* Try the explicit careers paths below. */ }

  if (!careersUrl) {
    for (const path of ['/careers', '/jobs', '/about/careers', '/company/careers', '/join', '/join-us', '/open-positions', '/work-with-us']) {
      try {
        const response = await page.goto(`https://${domain}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (response && response.status() >= 200 && response.status() < 400 && await inspect()) break;
      } catch { /* A failed or ambiguous path is not evidence. */ }
    }
  }
  const observedEvidence = evidence as ReturnType<typeof readCareersEvidence> | null;
  if (!careersUrl || !observedEvidence) return {
    ats: { ats_detected: null, careers_url: null, open_roles_count: null, evidence: 'No successfully observed careers page with visible careers heading' }, pagesVisited,
  };
  const candidates = [careersUrl, ...observedEvidence.urls];
  const matches = candidates.map(url => ({ url, vendor: atsVendorFromUrl(url) })).filter(item => item.vendor);
  const vendors = new Set(matches.map(item => item.vendor));
  const vendor = vendors.size === 1 ? matches[0].vendor : null;
  let count: number | null = null;
  try {
    count = (await stagehand.extract('Count visible open job listings. Return null if the count is not established.', z.object({ count: z.number().int().nonnegative().nullable() }), { page })).data.count;
    if (count !== null && (!Number.isInteger(count) || count < 0)) count = null;
  } catch { /* Role count is optional and remains unknown. */ }
  return {
    ats: {
      ats_detected: vendor, careers_url: careersUrl, open_roles_count: count,
      evidence: vendor
        ? `Observed careers-page URL or visible job link/embed on a recognized ${vendor} hostname: ${matches.find(item => item.vendor === vendor)!.url}. This is a vendor-domain signal, not proof of an installed integration.`
        : vendors.size > 1 ? 'Conflicting vendor-domain signals; ATS remains unknown' : 'Careers page observed; no recognized vendor hostname in its URL or visible job links/embeds',
    }, pagesVisited,
  };
}

function readMentionLinks() {
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
    .map(el => el.href);
}

function verifiedMentionUrl(candidate: string | null, discoveryUrl: string, domain: string, links: string[]): string | null {
  const normalize = (value: string) => {
    try {
      let url = new URL(value, discoveryUrl);
      if (url.origin === 'https://www.google.com' && url.pathname === '/url') {
        const target = url.searchParams.get('q') || url.searchParams.get('url');
        if (!target) return null;
        url = new URL(target);
      }
      const host = new URL(`https://${domain}`).hostname;
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          !(url.hostname === host || url.hostname.endsWith('.' + host))) return null;
      url.hash = '';
      return url.href;
    } catch { return null; }
  };
  if (!candidate?.trim()) return null;
  const target = normalize(candidate);
  return target && links.some(link => normalize(link) === target) ? target : null;
}

async function findPersonMentions(
  stagehand: Stagehand,
  domain: string,
  targetPerson: string,
): Promise<{ mentions: PersonMention[]; pagesVisited: string[] }> {
  const page = (await stagehand.browser.context.activePage())!;
  const pagesVisited: string[] = [];
  const allMentions: PersonMention[] = [];

  console.log(`  [Phase 2] Searching for mentions of "${targetPerson}"...`);

  // Use Google site-search to find person mentions on the domain
  const searchQuery = `site:${domain} "${targetPerson}"`;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

  try {
    await page.goto(googleUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const searchDiscoveryUrl = await page.url();
    pagesVisited.push(searchDiscoveryUrl);
    await page.waitForTimeout(3000);

    const searchLinks = await page.evaluate(readMentionLinks);

    // Extract Google search results that mention this person
    const searchResults = (
      await stagehand.extract(
        `Extract the search results from this Google page that reference "${targetPerson}".

      For each relevant result, extract:
      - article_url: The actual result link href, or null if unavailable
      - title: The page title / link text
      - context: The snippet text that shows where "${targetPerson}" is mentioned
      - date: Any date shown in the snippet
      - content_type: Classify as blog_post, press_release, case_study, news, about_page, or other based on the URL and title

      Only include results that are actually from the ${domain} website.
      Extract up to 10 results.`,
        BlogMentionsSchema,
      )
    ).data;

    for (const mention of searchResults.mentions) {
      allMentions.push({
        person_name: targetPerson,
        page_url: verifiedMentionUrl(mention.article_url, searchDiscoveryUrl, domain, searchLinks),
        discovery_url: searchDiscoveryUrl,
        evidence_kind: "search_snippet",
        page_title: mention.title,
        context: mention.context,
        content_type: mention.content_type,
        date: mention.date,
      });
    }

    console.log(
      `    Found ${allMentions.length} mentions via Google site-search`,
    );
  } catch (error) {
    console.log(
      `    Google site-search failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  // Also check the blog directly if no results from Google
  if (allMentions.length === 0) {
    const blogPaths = ["/blog", "/news", "/press", "/resources", "/insights"];

    for (const blogPath of blogPaths) {
      try {
        const blogUrl = `https://${domain}${blogPath}`;
        const response = await page.goto(blogUrl, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        if (response && response.status() < 400) {
          const listingDiscoveryUrl = await page.url();
          pagesVisited.push(listingDiscoveryUrl);
          const listingLinks = await page.evaluate(readMentionLinks);
          console.log(`    Checking blog at ${blogUrl}...`);
          await page.waitForTimeout(2000);

          // Search for person on the blog page
          const blogContent = await page.evaluate(
            () => document.documentElement.outerHTML,
          );
          if (blogContent.toLowerCase().includes(targetPerson.toLowerCase())) {
            const blogMentions = (
              await stagehand.extract(
                `Look for any references to "${targetPerson}" on this blog/news listing page.
              Extract the blog post titles, actual article link hrefs (article_url, or null if unavailable), and surrounding listing context. Do not claim to have read the linked article.`,
                BlogMentionsSchema,
              )
            ).data;

            for (const mention of blogMentions.mentions) {
              allMentions.push({
                person_name: targetPerson,
                page_url: verifiedMentionUrl(mention.article_url, listingDiscoveryUrl, domain, listingLinks),
                discovery_url: listingDiscoveryUrl,
                evidence_kind: "listing_excerpt",
                page_title: mention.title,
                context: mention.context,
                content_type: mention.content_type,
                date: mention.date,
              });
            }
          }
          break; // Found a blog, stop trying paths
        }
      } catch {
        // Path doesn't exist
      }
    }
  }

  return { mentions: allMentions, pagesVisited };
}

async function extractLeadershipAndSignals(
  stagehand: Stagehand,
  domain: string,
): Promise<{
  leadership: LeadershipMember[];
  techSignals: TechSignal[];
  companyDescription: string | null;
  pagesVisited: string[];
}> {
  const page = (await stagehand.browser.context.activePage())!;
  const pagesVisited: string[] = [];
  let leadership: LeadershipMember[] = [];
  let techSignals: TechSignal[] = [];
  let companyDescription: string | null = null;

  console.log("  [Phase 3] Extracting leadership & tech signals...");

  // Try About page variants
  const aboutPaths = [
    "/about",
    "/about-us",
    "/company",
    "/about/team",
    "/team",
    "/company/about",
    "/about/leadership",
    "/leadership",
  ];

  let foundAboutPage = false;

  for (const aboutPath of aboutPaths) {
    try {
      const aboutUrl = `https://${domain}${aboutPath}`;
      const response = await page.goto(aboutUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      if (response && response.status() < 400) {
        pagesVisited.push(aboutUrl);
        foundAboutPage = true;
        console.log(`    Found about page at: ${aboutUrl}`);
        await page.waitForTimeout(2000);

        // Extract leadership and company info
        try {
          const aboutData = (
            await stagehand.extract(
              `Extract information from this About/Team/Company page.

            Look for:
            1. Leadership team members - names, titles, departments
            2. A brief description of what the company does

            For leadership, look for sections like "Our Team", "Leadership", "Executive Team",
            or individual profile cards with names and titles.

            If this is just a general about page without team info, extract the company description
            and return an empty members array.`,
              LeadershipSchema,
            )
          ).data;

          leadership = aboutData.members.map((m) => ({
            name: m.name,
            title: m.title,
            department: m.department,
          }));
          companyDescription = aboutData.company_description;
        } catch {
          console.log("    Could not extract leadership data");
        }

        break;
      }
    } catch {
      // Path doesn't exist
    }
  }

  // If we didn't find leadership on about page, try the homepage
  if (!foundAboutPage) {
    try {
      const homeUrl = `https://${domain}`;
      await page.goto(homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      pagesVisited.push(homeUrl);
      await page.waitForTimeout(2000);

      const homeData = (
        await stagehand.extract(
          "Extract a 1-2 sentence description of what this company does from the homepage.",
          z.object({
            company_description: z.string().nullable(),
          }),
        )
      ).data;
      companyDescription = homeData.company_description;
    } catch {
      // Fine
    }
  }

  // Extract tech signals from careers/jobs page (if we can get there)
  try {
    // Try to find a job posting with tech stack info
    const careersUrl = `https://${domain}/careers`;
    const response = await page.goto(careersUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    if (response && response.status() < 400) {
      pagesVisited.push(careersUrl);
      await page.waitForTimeout(2000);

      try {
        const techData = (
          await stagehand.extract(
            `Analyze this careers/jobs page and extract technology signals.

          Look for:
          - Tech stack mentioned in job descriptions (e.g., "Experience with React, TypeScript, AWS")
          - Infrastructure hints (cloud providers, databases, tools)
          - Engineering culture signals (agile, remote, etc.)
          - Department-level insights from job categories

          Focus on technology-related signals that indicate what tools and platforms this company uses.`,
            TechSignalsSchema,
          )
        ).data;

        techSignals = techData.signals.map((s) => ({
          signal: s.signal,
          source: s.source,
          confidence: s.confidence,
        }));
      } catch {
        console.log("    Could not extract tech signals from careers page");
      }
    }
  } catch {
    // Careers page not accessible for tech signals
  }

  return { leadership, techSignals, companyDescription, pagesVisited };
}

// --- Main orchestrator ---

async function gatherCompanyIntel(
  input: IntelInput,
): Promise<CompanyIntelResult> {
  const startTime = Date.now();
  let sessionId: string | null = null;
  const allPagesVisited: string[] = [];

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          browserSettings: {
            advancedStealth: true,
            blockAds: true,
          },
          proxies: [
            {
              type: "browserbase",
              geolocation: {
                country: process.env.PROXY_COUNTRY || "US",
              },
            },
          ],
        },
      }),
      cache: true,
    }),
  );

  try {
    sessionId = stagehand.browser.sessionId ?? null;
    console.log(
      `  Session: https://www.browserbase.com/sessions/${sessionId}\n`,
    );

    // --- Phase 1: ATS Detection ---
    const atsResult = await detectATS(stagehand, input.domain);
    allPagesVisited.push(...atsResult.pagesVisited);

    console.log(
      `    => ATS: ${atsResult.ats.ats_detected ?? "Not detected"} | Roles: ${atsResult.ats.open_roles_count ?? "?"}\n`,
    );

    // --- Phase 2: Person Mentions (if target person specified) ---
    let personMentions: PersonMention[] = [];
    if (input.target_person) {
      const mentionsResult = await findPersonMentions(
        stagehand,
        input.domain,
        input.target_person,
      );
      personMentions = mentionsResult.mentions;
      allPagesVisited.push(...mentionsResult.pagesVisited);
      console.log(`    => Person mentions found: ${personMentions.length}\n`);
    }

    // --- Phase 3: Leadership & Tech Signals ---
    const leadershipResult = await extractLeadershipAndSignals(
      stagehand,
      input.domain,
    );
    allPagesVisited.push(...leadershipResult.pagesVisited);
    console.log(
      `    => Leadership: ${leadershipResult.leadership.length} members | Tech signals: ${leadershipResult.techSignals.length}\n`,
    );

    await stagehand.close();
    await stagehand.browser.close();

    return {
      company_name: input.company_name,
      domain: input.domain,
      target_person: input.target_person ?? null,
      ats: atsResult.ats,
      person_mentions: personMentions,
      leadership: leadershipResult.leadership,
      tech_signals: leadershipResult.techSignals,
      company_description: leadershipResult.companyDescription,
      pages_visited: [...new Set(allPagesVisited)],
      session_replay_url: sessionId
        ? `https://www.browserbase.com/sessions/${sessionId}`
        : null,
      duration_ms: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {
      // Ignore
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`  Error: ${errorMessage}`);

    return {
      company_name: input.company_name,
      domain: input.domain,
      target_person: input.target_person ?? null,
      ats: {
        ats_detected: null,
        careers_url: null,
        open_roles_count: null,
        evidence: `Error: ${errorMessage}`,
      },
      person_mentions: [],
      leadership: [],
      tech_signals: [],
      company_description: null,
      pages_visited: allPagesVisited,
      session_replay_url: sessionId
        ? `https://www.browserbase.com/sessions/${sessionId}`
        : null,
      duration_ms: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

// --- Print helpers ---

function printResult(result: CompanyIntelResult) {
  console.log("\n" + "=".repeat(70));
  console.log("COMPANY INTELLIGENCE REPORT");
  console.log("=".repeat(70));
  console.log(`  Company:     ${result.company_name}`);
  console.log(`  Domain:      ${result.domain}`);
  console.log(`  Description: ${result.company_description ?? "N/A"}`);
  console.log(`  Duration:    ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`  Pages:       ${result.pages_visited.length} visited`);

  console.log("\n--- ATS DETECTION ---");
  console.log(`  Platform:    ${result.ats.ats_detected ?? "Not detected"}`);
  console.log(`  Careers URL: ${result.ats.careers_url ?? "Not found"}`);
  console.log(`  Open Roles:  ${result.ats.open_roles_count ?? "Unknown"}`);
  console.log(`  Evidence:    ${result.ats.evidence}`);

  if (result.leadership.length > 0) {
    console.log("\n--- LEADERSHIP ---");
    result.leadership.forEach((m) => {
      console.log(
        `  \u2022 ${m.name} — ${m.title}${m.department ? ` (${m.department})` : ""}`,
      );
    });
  }

  if (result.person_mentions.length > 0) {
    console.log(`\n--- MENTIONS OF "${result.target_person}" ---`);
    result.person_mentions.forEach((m) => {
      console.log(`  \u2022 [${m.content_type}] ${m.page_title}`);
      console.log(`    "${m.context}"`);
      if (m.date) console.log(`    Date: ${m.date}`);
    });
  }

  if (result.tech_signals.length > 0) {
    console.log("\n--- TECH SIGNALS ---");
    result.tech_signals.forEach((s) => {
      console.log(`  \u2022 ${s.signal} (${s.confidence}) — from ${s.source}`);
    });
  }

  if (result.session_replay_url) {
    console.log(`\n  Session Replay: ${result.session_replay_url}`);
  }

  console.log("\n" + "=".repeat(70));
}

// --- Main ---

async function main() {
  // Companies to analyze — swap these out or read from a CSV
  const input: IntelInput = {
    company_name: "Browserbase",
    domain: "browserbase.com",
    target_person: "Paul Klein",
  };

  console.log("\n" + "=".repeat(60));
  console.log("COMPANY INTELLIGENCE SCRAPER");
  console.log("=".repeat(60));
  console.log(`  Company: ${input.company_name}`);
  console.log(`  Domain:  ${input.domain}`);
  if (input.target_person) console.log(`  Target:  ${input.target_person}`);
  console.log("=".repeat(60));

  const result = await gatherCompanyIntel(input);
  printResult(result);
  console.log(JSON.stringify(result, null, 2));
}

// Exports
export { gatherCompanyIntel, IntelInput, CompanyIntelResult };

main().catch(console.error);
