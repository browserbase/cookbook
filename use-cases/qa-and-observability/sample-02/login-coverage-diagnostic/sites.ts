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

export type SiteId = 'opentable' | 'sitedish' | 'aestheticrecord' | 'fedex';

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
  // alpha-2). Sitedish is a Dutch (.nl) test environment, so a NL exit IP looks
  // far more natural than a US one and is a likely unblock lever.
  proxyCountry?: string;
  // Browserbase region nearest the origin — lower latency, more natural posture.
  region?: string;
  // OS fingerprint for stealth mode (browserSettings.os). Per the internal
  // Stealth x Support matrix: Akamai needs a windows|mac fingerprint; Cloudflare
  // on advanced stealth needs a NON-windows fingerprint. 'mac' satisfies both, so
  // it's the universal default for these sites. Only applied under a stealth
  // profile (verified or advancedStealth).
  os?: 'windows' | 'mac' | 'linux' | 'mobile' | 'tablet';
  // Extra settle time (ms) after navigation before we classify. Akamai sensor
  // scripts (ak_bmsc / abck) need a beat to run before the page is representative.
  settleMs?: number;
  // What we SUSPECT sits in front of the login. Hypothesis only, documented for
  // the SE — the harness reports what it actually observes, it does not assume.
  suspectedDefense: string;
}

export const SITES: SiteSpec[] = [
  {
    id: 'opentable',
    label: 'OpenTable GuestCenter',
    url: 'https://guestcenter.opentable.com/login',
    usernameEnv: 'OPENTABLE_USERNAME',
    passwordEnv: 'OPENTABLE_PASSWORD',
    usernameField: 'the email or username field',
    passwordField: 'the password field',
    submitButton: 'the Sign In button',
    region: 'us-east-1',
    os: 'mac',
    settleMs: 9000,
    suspectedDefense: 'Akamai Bot Manager (OpenTable is known to run Akamai), possible reCAPTCHA on submit',
  },
  {
    id: 'sitedish',
    label: 'Sitedish (mijn-test)',
    url: 'https://mijn-test.sitedish.nl/',
    usernameEnv: 'SITEDISH_USERNAME',
    passwordEnv: 'SITEDISH_PASSWORD',
    usernameField: 'the username or e-mail field (Dutch label may read "Gebruikersnaam" or "E-mailadres")',
    passwordField: 'the password field (Dutch label "Wachtwoord")',
    submitButton: 'the login button (Dutch label "Inloggen")',
    proxyCountry: 'NL',
    region: 'eu-central-1',
    os: 'mac',
    suspectedDefense: 'unknown — smaller NL ordering platform; most likely reCAPTCHA. A NL exit IP is the first lever to try',
  },
  {
    id: 'aestheticrecord',
    label: 'Aesthetic Record',
    url: 'https://app.aestheticrecord.com/login',
    usernameEnv: 'AESTHETICRECORD_USERNAME',
    passwordEnv: 'AESTHETICRECORD_PASSWORD',
    usernameField: 'the email field',
    passwordField: 'the password field',
    submitButton: 'the Login button',
    region: 'us-east-1',
    os: 'mac',
    suspectedDefense: 'reCAPTCHA / Cloudflare. NOTE: customer said they already found a workaround for this one',
  },
  {
    id: 'fedex',
    label: 'FedEx',
    url: 'https://www.fedex.com/secure-login/en-us/#/credentials',
    usernameEnv: 'FEDEX_USERNAME',
    passwordEnv: 'FEDEX_PASSWORD',
    usernameField: 'the User ID field',
    passwordField: 'the password field',
    submitButton: 'the Log In button',
    region: 'us-east-1',
    os: 'mac',
    settleMs: 9000,
    suspectedDefense: 'Akamai Bot Manager (FedEx is a well-known Akamai property)',
  },
];
