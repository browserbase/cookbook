// Four representative platforms used to assess Browserbase login coverage. The
// original evaluator reported that the enterprise
// "verified" trial — verified browser + residential proxies + a persistent
// Context — still gets blocked at the LOGIN step (captcha rejection) on every
// one of these, unblocking "zero extra platforms" vs the normal tier. The job
// here is to reproduce that and find a configuration that gets us past the wall.
//
// Each entry is one login page plus the hints the harness needs to (a) detect
// whether we even reached a usable form, and (b) attempt an authenticated login
// once real credentials are dropped into .env. Credentials are placeholders for
// now — see .env.example.

export type SiteId = 'portal-a' | 'portal-b' | 'portal-c' | 'portal-d';

export interface SiteSpec {
  id: SiteId;
  label: string;
  url: string;
  // Env vars the credentials come from. The harness attempts a login only when
  // BOTH are set to a non-placeholder value.
  usernameEnv: string;
  passwordEnv: string;
  // Natural-language hints for Stagehand `act()` during the login attempt.
  // These don't have to be exact selectors — act() resolves them at runtime.
  usernameField: string;
  passwordField: string;
  submitButton: string;
  // Optional: route the residential proxy through this country (ISO-3166-1
  // alpha-2). Portal B is a Dutch (.nl) test environment, so a NL exit IP looks
  // far more natural than a US one and is a likely unblock lever.
  proxyCountry?: string;
  // Browserbase region nearest the origin — lower latency, more natural posture.
  region?: string;
  // OS fingerprint for Verified (browserSettings.os). Akamai needs a windows|mac
  // fingerprint; Cloudflare needs a non-Windows fingerprint. 'mac' satisfies both, so
  // it's the universal default for these sites. Only applied under the Verified
  // profile.
  os?: 'windows' | 'mac' | 'linux' | 'mobile' | 'tablet';
  // Extra settle time (ms) after navigation before we classify. Akamai sensor
  // scripts (ak_bmsc / abck) need a beat to run before the page is representative.
  settleMs?: number;
  // What we SUSPECT sits in front of the login. Hypothesis only, documented for
  // technical reviewers — the harness reports what it actually observes, it does not assume.
  suspectedDefense: string;
}

export const SITES: SiteSpec[] = [
  {
    id: 'portal-a',
    label: 'Portal A',
    url: 'https://example.invalid/portal-a/login',
    usernameEnv: 'PORTAL_A_USERNAME',
    passwordEnv: 'PORTAL_A_PASSWORD',
    usernameField: 'the email or username field',
    passwordField: 'the password field',
    submitButton: 'the Sign In button',
    region: 'us-east-1',
    os: 'mac',
    settleMs: 9000,
    suspectedDefense: 'Akamai Bot Manager (Portal A is known to run Akamai), possible reCAPTCHA on submit',
  },
  {
    id: 'portal-b',
    label: 'Portal B',
    url: 'https://example.invalid/portal-b/login',
    usernameEnv: 'PORTAL_B_USERNAME',
    passwordEnv: 'PORTAL_B_PASSWORD',
    usernameField: 'the username or e-mail field (Dutch label may read "Gebruikersnaam" or "E-mailadres")',
    passwordField: 'the password field (Dutch label "Wachtwoord")',
    submitButton: 'the login button (Dutch label "Inloggen")',
    proxyCountry: 'NL',
    region: 'eu-central-1',
    os: 'mac',
    suspectedDefense: 'unknown — smaller NL ordering platform; most likely reCAPTCHA. A NL exit IP is the first lever to try',
  },
  {
    id: 'portal-c',
    label: 'Portal C',
    url: 'https://example.invalid/portal-c/login',
    usernameEnv: 'AESTHETICRECORD_USERNAME',
    passwordEnv: 'AESTHETICRECORD_PASSWORD',
    usernameField: 'the email field',
    passwordField: 'the password field',
    submitButton: 'the Login button',
    region: 'us-east-1',
    os: 'mac',
    suspectedDefense: 'reCAPTCHA / Cloudflare. NOTE: one baseline run used an alternate configuration for this one',
  },
  {
    id: 'portal-d',
    label: 'Portal D',
    url: 'https://example.invalid/portal-d/login',
    usernameEnv: 'PORTAL_D_USERNAME',
    passwordEnv: 'PORTAL_D_PASSWORD',
    usernameField: 'the User ID field',
    passwordField: 'the password field',
    submitButton: 'the Log In button',
    region: 'us-east-1',
    os: 'mac',
    settleMs: 9000,
    suspectedDefense: 'Akamai Bot Manager (Portal D is a well-known Akamai property)',
  },
];
