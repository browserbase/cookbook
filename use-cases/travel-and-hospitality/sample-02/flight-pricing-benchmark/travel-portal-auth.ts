export type TravelPortalAuthEvidence = {
  url: string;
  text: string;
  signInControls: boolean;
  accountControls: boolean;
  travelControls: boolean;
};

/** Serialized into page.evaluate: reads visible semantics, never form values. */
export function readTravelPortalAuthEvidence(): TravelPortalAuthEvidence {
  const stylesVisible = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    }
    return true;
  };
  const visible = (element: Element) => element.getClientRects().length > 0 && stylesVisible(element);
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const label = (element: Element): string => {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const name = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" ");
      if (name.trim()) return normalize(name);
    }
    const aria = element.getAttribute("aria-label");
    if (aria) return normalize(aria);
    const control = element as HTMLInputElement;
    const labels = control.labels;
    if (labels?.length) return normalize(Array.from(labels).map(item => item.textContent ?? "").join(" "));
    // Input values may contain credentials; placeholder and title are labels only.
    if (element.matches("input,textarea,select")) return normalize(element.getAttribute("placeholder") ?? element.getAttribute("title") ?? "");
    return normalize(element.textContent ?? element.getAttribute("title") ?? "");
  };
  const controls = Array.from(document.querySelectorAll('button,a[href],[role="link"],[role="button"],[role="menuitem"],input,select,textarea,[role="combobox"]')).filter(visible);
  const signInName = /\b(?:sign[ -]?in|log[ -]?in|sso|single sign[ -]?on|sign[ -]?up|create (?:an? )?account|continue with (?:google|microsoft|apple|okta))\b/i;
  const signInControls = controls.some(element => {
    const type = element.getAttribute("type")?.toLowerCase();
    const autocomplete = element.getAttribute("autocomplete")?.toLowerCase() ?? "";
    const name = label(element);
    const fieldName = normalize(element.getAttribute("name") ?? "");
    return (element.matches("input") && /^(?:email|username|user_name|user-name|password)$/.test(fieldName)) || type === "password" || type === "email" || /(?:^|\s)(?:username|current-password|new-password)(?:\s|$)/.test(autocomplete) || (element.matches('input,textarea,[role="combobox"]') && /\b(?:email|user[ -]?name|password)\b/.test(name)) || signInName.test(name);
  });
  const actionable = controls.filter(element => element.matches('button,a[href],[role="link"],[role="button"],[role="menuitem"]'));
  const accountControls = actionable.some(element => /^(?:(?:open |my )?(?:profile|account)(?: menu| settings)?|(?:sign|log)[ -]?out)$/.test(label(element)));
  const travelNavigation = actionable.some(element => /^(?:flights?|hotels?|book travel|my trips)$/.test(label(element)));
  const search = controls.filter(element => element.matches('input,select,[role="combobox"]'));
  const origin = search.some(element => /^(?:origin|from|departure(?: airport| city)?)$/.test(label(element)));
  const destination = search.some(element => /^(?:destination|to|arrival(?: airport| city)?)$/.test(label(element)));
  const parts: string[] = [];
  if (document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || parent.closest('script,style,input,textarea,[contenteditable]') || !stylesVisible(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      if (!range.getClientRects().length) continue;
      const text = walker.currentNode.textContent?.trim();
      if (text) parts.push(text);
    }
  }
  return { url: location.href, text: parts.join(" "), signInControls, accountControls, travelControls: travelNavigation || (origin && destination) };
}

/** Semantic workspace evidence only; does not verify account identity or live selectors. */
export function classifyTravelPortalAuth(evidence: TravelPortalAuthEvidence): "authenticated" | "unauthenticated" | "unknown" {
  if (!evidence || typeof evidence.url !== "string" || typeof evidence.text !== "string") return "unknown";
  const gate = /captcha|magic link|check your email|email link|verification code|verify your email|multi-factor|two-factor|\bmfa\b|enter (?:the )?(?:code|verification)|security check|\b(?:sign[ -]?up|sign[ -]?in|log[ -]?in|create (?:an? )?account)\b/i;
  if (evidence.signInControls === true || gate.test(evidence.text)) return "unauthenticated";
  let url: URL;
  try { url = new URL(evidence.url); } catch { return "unknown"; }
  // Check the literal authority too: URL normalizes an explicit :443 port away.
  if (!/^https:\/\/app\.travel\.example(?:\/|$)/i.test(evidence.url) || url.origin !== "https://app.travel.example" || url.username || url.password || url.port || !/^\/app(?:\/|$)/.test(url.pathname)) return "unknown";
  return evidence.accountControls === true && evidence.travelControls === true && evidence.signInControls === false ? "authenticated" : "unknown";
}
